import 'server-only'
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  activityHosts,
  dateOptions,
  dateVotes,
  gameNights,
  gameOptions,
  gameVotes,
  memberRoles,
  nightActivities,
  nightGames,
  nightHosts,
  rsvps,
} from '@/lib/db/schema'
import { getUsers, type PublicUser } from '@/lib/users'
import { parseUuid } from '@/lib/validation'

export type NightRow = typeof gameNights.$inferSelect
export type NightSummary = NightRow & { going: number; art: string | null; gameNames: string[]; lengthMinutes: number }
export type DateResponse = 'available' | 'maybe' | 'unavailable'
export type RsvpStatus = 'going' | 'maybe' | 'not_going' | 'waitlist'

async function decorate(rows: NightRow[]): Promise<NightSummary[]> {
  if (!rows.length) return []
  const ids = rows.map((row) => row.id)
  const [going, games, activities] = await Promise.all([
    db
      .select({ id: rsvps.gameNightId, n: count() })
      .from(rsvps)
      .where(and(inArray(rsvps.gameNightId, ids), eq(rsvps.status, 'going')))
      .groupBy(rsvps.gameNightId),
    db.select().from(nightGames).where(inArray(nightGames.gameNightId, ids)).orderBy(asc(nightGames.position)),
    db
      .select({ id: nightActivities.gameNightId, end: sql<number>`coalesce(max(${nightActivities.startOffset} + ${nightActivities.duration}), 0)` })
      .from(nightActivities)
      .where(inArray(nightActivities.gameNightId, ids))
      .groupBy(nightActivities.gameNightId),
  ])
  const totals = new Map(going.map((row) => [row.id, row.n]))
  const lengths = new Map(activities.map((row) => [row.id, Number(row.end)]))
  return rows.map((row) => {
    const own = games.filter((game) => game.gameNightId === row.id)
    return {
      ...row,
      going: totals.get(row.id) ?? 0,
      art: row.bannerUrl ?? own.find((game) => game.backgroundUrl)?.backgroundUrl ?? own.find((game) => game.coverUrl)?.coverUrl ?? null,
      gameNames: own.map((game) => game.name),
      lengthMinutes: lengths.get(row.id) || 180,
    }
  })
}

export async function listPublishedNights() {
  const rows = await db
    .select()
    .from(gameNights)
    .where(and(inArray(gameNights.status, ['published', 'cancelled']), eq(gameNights.isTemplate, false)))
    .orderBy(sql`${gameNights.startsAt} asc nulls last`)
  return decorate(rows)
}

export async function listAllNights() {
  const rows = await db.select().from(gameNights).where(eq(gameNights.isTemplate, false)).orderBy(desc(gameNights.createdAt))
  return decorate(rows)
}

export async function listTemplates() {
  return db.select().from(gameNights).where(eq(gameNights.isTemplate, true)).orderBy(desc(gameNights.createdAt))
}

export async function listMyNights(userId: string) {
  const mine = await db
    .select({ id: rsvps.gameNightId, status: rsvps.status })
    .from(rsvps)
    .where(and(eq(rsvps.userId, userId), inArray(rsvps.status, ['going', 'maybe', 'waitlist'])))
  if (!mine.length) return []
  const rows = await db
    .select()
    .from(gameNights)
    .where(and(inArray(gameNights.id, mine.map((row) => row.id)), eq(gameNights.status, 'published')))
  const nights = await decorate(rows)
  const status = new Map(mine.map((row) => [row.id, row.status as RsvpStatus]))
  return nights.map((night) => ({ ...night, myStatus: status.get(night.id)! }))
}

export type Attendee = { user: PublicUser; status: RsvpStatus; checkedIn: boolean; answer: string | null }

export async function getNightDetail(rawId: string, viewerId: string | null) {
  const id = parseUuid(rawId)
  if (!id) return null
  const [night] = await db.select().from(gameNights).where(eq(gameNights.id, id)).limit(1)
  if (!night) return null

  const [dates, pollGames, rsvpRows, gameVoteRows, games, hosts, activities] = await Promise.all([
    db.select().from(dateOptions).where(eq(dateOptions.gameNightId, id)).orderBy(asc(dateOptions.startsAt)),
    db.select().from(gameOptions).where(eq(gameOptions.gameNightId, id)).orderBy(asc(gameOptions.createdAt)),
    db.select().from(rsvps).where(eq(rsvps.gameNightId, id)).orderBy(asc(rsvps.createdAt)),
    db.select().from(gameVotes).where(eq(gameVotes.gameNightId, id)),
    db.select().from(nightGames).where(eq(nightGames.gameNightId, id)).orderBy(asc(nightGames.position), asc(nightGames.createdAt)),
    db.select().from(nightHosts).where(eq(nightHosts.gameNightId, id)).orderBy(asc(nightHosts.createdAt)),
    db.select().from(nightActivities).where(eq(nightActivities.gameNightId, id)).orderBy(asc(nightActivities.startOffset), asc(nightActivities.position)),
  ])
  const [dateVoteRows, activityHostRows] = await Promise.all([
    dates.length ? db.select().from(dateVotes).where(inArray(dateVotes.dateOptionId, dates.map((date) => date.id))) : [],
    activities.length ? db.select().from(activityHosts).where(inArray(activityHosts.activityId, activities.map((activity) => activity.id))) : [],
  ])

  const userIds = [...rsvpRows.map((row) => row.userId), ...hosts.map((host) => host.userId), ...activityHostRows.map((row) => row.userId)]
  const users = await getUsers(userIds)

  const dateList = dates.map((date) => {
    const votes = dateVoteRows.filter((vote) => vote.dateOptionId === date.id)
    const available = votes.filter((vote) => vote.response === 'available').length
    const maybe = votes.filter((vote) => vote.response === 'maybe').length
    const unavailable = votes.filter((vote) => vote.response === 'unavailable').length
    return {
      ...date,
      available,
      maybe,
      unavailable,
      score: available * 2 + maybe,
      mine: (votes.find((vote) => vote.userId === viewerId)?.response ?? null) as DateResponse | null,
    }
  })
  const best = dateList.length ? Math.max(...dateList.map((date) => date.score)) : 0
  const dateOptionsWithBest = dateList.map((date) => ({ ...date, best: best > 0 && date.score === best }))

  const gameList = pollGames.map((game) => ({
    ...game,
    votes: gameVoteRows.filter((vote) => vote.gameOptionId === game.id).length,
    mine: gameVoteRows.some((vote) => vote.gameOptionId === game.id && vote.userId === viewerId),
  }))

  const attendees: Attendee[] = rsvpRows.map((row) => ({
    user: users.get(row.userId)!,
    status: row.status as RsvpStatus,
    checkedIn: row.checkedInAt !== null,
    answer: row.answer,
  }))
  const waitlistIds = rsvpRows.filter((row) => row.status === 'waitlist').map((row) => row.userId)
  const mineRow = rsvpRows.find((row) => row.userId === viewerId)

  return {
    night,
    dates: dateOptionsWithBest,
    pollGames: gameList,
    games,
    hosts: hosts.map((host) => ({ ...host, user: users.get(host.userId)! })),
    activities: activities.map((activity) => ({
      ...activity,
      hosts: activityHostRows.filter((row) => row.activityId === activity.id).map((row) => users.get(row.userId)!),
      hostIds: activityHostRows.filter((row) => row.activityId === activity.id).map((row) => row.userId),
    })),
    rsvp: {
      going: rsvpRows.filter((row) => row.status === 'going').length,
      maybe: rsvpRows.filter((row) => row.status === 'maybe').length,
      notGoing: rsvpRows.filter((row) => row.status === 'not_going').length,
      waitlist: waitlistIds.length,
      checkedIn: rsvpRows.filter((row) => row.checkedInAt !== null).length,
      mine: (mineRow?.status ?? null) as RsvpStatus | null,
      mineAnswer: mineRow?.answer ?? null,
      myWaitlistPosition: mineRow?.status === 'waitlist' ? waitlistIds.indexOf(viewerId!) + 1 : null,
    },
    attendees,
    lengthMinutes: activities.reduce((max, activity) => Math.max(max, activity.startOffset + activity.duration), 0) || 180,
  }
}

export type NightDetail = NonNullable<Awaited<ReturnType<typeof getNightDetail>>>

export async function listTeam() {
  const result = await db.execute<{ user_id: string; role: string; name: string | null; email: string | null }>(
    sql`select r.user_id, r.role, u.name, u.email
        from ${memberRoles} r
        left join neon_auth."user" u on u.id::text = r.user_id
        order by case r.role when 'owner' then 0 else 1 end, r.created_at`,
  )
  return result.rows
}
