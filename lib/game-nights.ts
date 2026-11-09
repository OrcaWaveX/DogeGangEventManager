import 'server-only'
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dateOptions, dateVotes, gameNights, gameOptions, gameVotes, memberRoles, rsvps } from '@/lib/db/schema'
import { parseUuid } from '@/lib/validation'

export type NightSummary = typeof gameNights.$inferSelect & { going: number }
export type DateResponse = 'available' | 'maybe' | 'unavailable'
export type RsvpStatus = 'going' | 'maybe' | 'not_going'

async function withGoingCounts(rows: (typeof gameNights.$inferSelect)[]): Promise<NightSummary[]> {
  if (!rows.length) return []
  const going = await db
    .select({ id: rsvps.gameNightId, n: count() })
    .from(rsvps)
    .where(and(inArray(rsvps.gameNightId, rows.map((row) => row.id)), eq(rsvps.status, 'going')))
    .groupBy(rsvps.gameNightId)
  const totals = new Map(going.map((row) => [row.id, row.n]))
  return rows.map((row) => ({ ...row, going: totals.get(row.id) ?? 0 }))
}

export async function listPublishedNights() {
  const rows = await db
    .select()
    .from(gameNights)
    .where(eq(gameNights.status, 'published'))
    .orderBy(sql`${gameNights.startsAt} asc nulls last`)
  return withGoingCounts(rows)
}

export async function listAllNights() {
  const rows = await db.select().from(gameNights).orderBy(desc(gameNights.createdAt))
  return withGoingCounts(rows)
}

export async function getNightDetail(rawId: string, viewerId: string | null) {
  const id = parseUuid(rawId)
  if (!id) return null
  const [night] = await db.select().from(gameNights).where(eq(gameNights.id, id)).limit(1)
  if (!night) return null

  const [dates, games, rsvpRows, gameVoteRows] = await Promise.all([
    db.select().from(dateOptions).where(eq(dateOptions.gameNightId, id)).orderBy(asc(dateOptions.startsAt)),
    db.select().from(gameOptions).where(eq(gameOptions.gameNightId, id)).orderBy(asc(gameOptions.createdAt)),
    db.select().from(rsvps).where(eq(rsvps.gameNightId, id)),
    db.select().from(gameVotes).where(eq(gameVotes.gameNightId, id)),
  ])
  const dateVoteRows = dates.length
    ? await db.select().from(dateVotes).where(inArray(dateVotes.dateOptionId, dates.map((date) => date.id)))
    : []

  const dateList = dates.map((date) => {
    const votes = dateVoteRows.filter((vote) => vote.dateOptionId === date.id)
    return {
      ...date,
      available: votes.filter((vote) => vote.response === 'available').length,
      maybe: votes.filter((vote) => vote.response === 'maybe').length,
      unavailable: votes.filter((vote) => vote.response === 'unavailable').length,
      mine: (votes.find((vote) => vote.userId === viewerId)?.response ?? null) as DateResponse | null,
    }
  })

  const gameList = games.map((game) => ({
    ...game,
    votes: gameVoteRows.filter((vote) => vote.gameOptionId === game.id).length,
    mine: gameVoteRows.some((vote) => vote.gameOptionId === game.id && vote.userId === viewerId),
  }))

  const goingIds = rsvpRows.filter((row) => row.status === 'going').map((row) => row.userId)
  let attendees: string[] = []
  if (goingIds.length) {
    try {
      const result = await db.execute<{ name: string }>(
        sql`select name from neon_auth."user" where id::text in (${sql.join(goingIds.map((userId) => sql`${userId}`), sql`, `)}) order by name`,
      )
      attendees = result.rows.map((row) => row.name)
    } catch (error) {
      console.error('[v0] Could not load attendee names', error instanceof Error ? error.message : 'Unknown failure')
    }
  }

  return {
    night,
    dates: dateList,
    games: gameList,
    rsvp: {
      going: goingIds.length,
      maybe: rsvpRows.filter((row) => row.status === 'maybe').length,
      notGoing: rsvpRows.filter((row) => row.status === 'not_going').length,
      mine: (rsvpRows.find((row) => row.userId === viewerId)?.status ?? null) as RsvpStatus | null,
    },
    attendees,
  }
}

export async function listTeam() {
  const result = await db.execute<{ user_id: string; role: string; name: string | null; email: string | null }>(
    sql`select r.user_id, r.role, u.name, u.email
        from ${memberRoles} r
        left join neon_auth."user" u on u.id::text = r.user_id
        order by case r.role when 'owner' then 0 else 1 end, r.created_at`,
  )
  return result.rows
}
