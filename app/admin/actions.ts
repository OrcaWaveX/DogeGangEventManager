'use server'

import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireNightAccess } from '@/lib/access'
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
  userGames,
} from '@/lib/db/schema'
import { customGame, parsePickedGame, type PickedGame } from '@/lib/games'
import { notify } from '@/lib/notifications'
import { requireAdmin, requireOwner } from '@/lib/session'
import { listMembers } from '@/lib/users'
import { parseCapacity, parseDate, parseHttpsUrl, parseText, parseUuid } from '@/lib/validation'

function refresh() {
  revalidatePath('/', 'layout')
}

function oneOf<T extends string>(value: FormDataEntryValue | null, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

function readDetails(formData: FormData) {
  return {
    title: parseText(formData.get('title'), 100),
    description: parseText(formData.get('description'), 2000),
    startsAt: parseDate(formData.get('startsAt')),
    capacity: parseCapacity(formData.get('capacity')),
    discordUrl: parseHttpsUrl(formData.get('discordUrl')),
    bannerUrl: parseHttpsUrl(formData.get('bannerUrl')),
    rsvpDeadline: parseDate(formData.get('rsvpDeadline')),
    waitlistEnabled: formData.get('waitlistEnabled') === 'on',
    rsvpQuestion: parseText(formData.get('rsvpQuestion'), 140) || null,
    schedulingDeadline: parseDate(formData.get('schedulingDeadline')),
    gameVotingDeadline: parseDate(formData.get('gameVotingDeadline')),
    gameVoteMode: oneOf(formData.get('gameVoteMode'), ['single', 'multi'] as const, 'single'),
    recurrence: oneOf(formData.get('recurrence'), ['none', 'weekly', 'biweekly', 'monthly'] as const, 'none'),
  }
}

async function audience(nightId: string, statuses: string[]) {
  const rows = await db
    .select({ userId: rsvps.userId })
    .from(rsvps)
    .where(and(eq(rsvps.gameNightId, nightId), inArray(rsvps.status, statuses)))
  return rows.map((row) => row.userId)
}

export async function promoteWaitlist(nightId: string) {
  const [night] = await db.select().from(gameNights).where(eq(gameNights.id, nightId)).limit(1)
  if (!night?.capacity) return
  const going = await db.select({ userId: rsvps.userId }).from(rsvps).where(and(eq(rsvps.gameNightId, nightId), eq(rsvps.status, 'going')))
  const open = night.capacity - going.length
  if (open <= 0) return
  const waiting = await db
    .select({ userId: rsvps.userId })
    .from(rsvps)
    .where(and(eq(rsvps.gameNightId, nightId), eq(rsvps.status, 'waitlist')))
    .orderBy(asc(rsvps.updatedAt))
    .limit(open)
  if (!waiting.length) return
  await db
    .update(rsvps)
    .set({ status: 'going', updatedAt: new Date() })
    .where(and(eq(rsvps.gameNightId, nightId), inArray(rsvps.userId, waiting.map((row) => row.userId))))
  await notify(
    waiting.map((row) => ({
      userId: row.userId,
      type: 'waitlist',
      gameNightId: nightId,
      title: `You're in for ${night.title}`,
      body: 'A spot opened up and you moved off the waitlist.',
      href: `/game-nights/${nightId}`,
      dedupeKey: `waitlist:${nightId}:${Date.now()}`,
    })),
  )
}

export async function createGameNight(formData: FormData) {
  const admin = await requireAdmin()
  const details = readDetails(formData)
  if (!details.title) redirect('/admin?error=title')
  const [night] = await db.insert(gameNights).values({ ...details, userId: admin.id, status: 'draft' }).returning({ id: gameNights.id })
  refresh()
  redirect(`/admin/game-nights/${night.id}`)
}

export async function updateGameNight(formData: FormData) {
  const { nightId } = await requireNightAccess(formData.get('id'), 'run')
  const details = readDetails(formData)
  if (!details.title) redirect(`/admin/game-nights/${nightId}?error=title`)
  await db
    .update(gameNights)
    .set({
      ...details,
      schedulingOpen: formData.get('schedulingOpen') === 'on',
      gameVotingOpen: formData.get('gameVotingOpen') === 'on',
    })
    .where(eq(gameNights.id, nightId))
  await promoteWaitlist(nightId)
  refresh()
  redirect(`/admin/game-nights/${nightId}?saved=1`)
}

export async function setNightStatus(formData: FormData) {
  const { nightId } = await requireNightAccess(formData.get('id'), 'admin')
  const status = formData.get('status')
  if (status !== 'draft' && status !== 'published' && status !== 'archived' && status !== 'cancelled') return
  const [before] = await db.select().from(gameNights).where(eq(gameNights.id, nightId)).limit(1)
  if (!before) return
  await db.update(gameNights).set({ status }).where(eq(gameNights.id, nightId))

  if (status === 'published' && before.status === 'draft') {
    const members = await listMembers()
    await notify(
      members.map((member) => ({
        userId: member.id,
        type: 'new_night',
        gameNightId: nightId,
        title: `New game night: ${before.title}`,
        body: before.startsAt ? 'RSVP now to save your spot.' : 'Dates are still being decided. Cast your vote.',
        href: `/game-nights/${nightId}`,
        dedupeKey: `new:${nightId}`,
      })),
    )
  }
  if (status === 'cancelled') {
    const users = await audience(nightId, ['going', 'maybe', 'waitlist'])
    await notify(
      users.map((userId) => ({
        userId,
        type: 'cancelled',
        gameNightId: nightId,
        title: `${before.title} was cancelled`,
        href: `/game-nights/${nightId}`,
        dedupeKey: `cancelled:${nightId}`,
      })),
    )
  }
  refresh()
}

export async function addDateOption(formData: FormData) {
  const { nightId } = await requireNightAccess(formData.get('nightId'), 'run')
  const startsAt = parseDate(formData.get('startsAt'))
  if (!startsAt) return
  await db.insert(dateOptions).values({ gameNightId: nightId, startsAt })
  refresh()
}

export async function removeDateOption(formData: FormData) {
  const { nightId } = await requireNightAccess(formData.get('nightId'), 'run')
  const optionId = parseUuid(formData.get('optionId'))
  if (!optionId) return
  await db.transaction(async (tx) => {
    await tx.delete(dateVotes).where(eq(dateVotes.dateOptionId, optionId))
    await tx.delete(dateOptions).where(and(eq(dateOptions.id, optionId), eq(dateOptions.gameNightId, nightId)))
  })
  refresh()
}

export async function lockInDate(formData: FormData) {
  const { nightId } = await requireNightAccess(formData.get('nightId'), 'run')
  const optionId = parseUuid(formData.get('optionId'))
  if (!optionId) return
  const [option] = await db.select().from(dateOptions).where(eq(dateOptions.id, optionId)).limit(1)
  if (!option || option.gameNightId !== nightId) return
  const [night] = await db.select().from(gameNights).where(eq(gameNights.id, nightId)).limit(1)
  await db.update(gameNights).set({ startsAt: option.startsAt, schedulingOpen: false }).where(eq(gameNights.id, nightId))
  const users = await audience(nightId, ['going', 'maybe', 'waitlist'])
  await notify(
    users.map((userId) => ({
      userId,
      type: 'date_locked',
      gameNightId: nightId,
      title: `${night?.title ?? 'Game night'} has a date`,
      body: 'The date was locked in. Check it fits your schedule.',
      href: `/game-nights/${nightId}`,
      dedupeKey: `date:${nightId}:${option.startsAt.getTime()}`,
    })),
  )
  refresh()
}

async function upsertNightGame(nightId: string, game: PickedGame, addedBy: string) {
  const [last] = await db
    .select({ position: nightGames.position })
    .from(nightGames)
    .where(eq(nightGames.gameNightId, nightId))
    .orderBy(sql`${nightGames.position} desc`)
    .limit(1)
  await db
    .insert(nightGames)
    .values({ ...game, gameNightId: nightId, position: (last?.position ?? -1) + 1, addedBy })
    .onConflictDoNothing()
  await db
    .insert(userGames)
    .values({ ...game, userId: addedBy })
    .onConflictDoUpdate({ target: [userGames.userId, userGames.source, userGames.externalId], set: { lastUsedAt: new Date() } })
}

function readGame(formData: FormData): PickedGame | null {
  const raw = formData.get('game')
  if (typeof raw === 'string' && raw) {
    try {
      return parsePickedGame(JSON.parse(raw))
    } catch {
      return null
    }
  }
  const name = parseText(formData.get('name'), 80)
  return name ? customGame(name) : null
}

export async function addNightGame(formData: FormData) {
  const { nightId, viewer } = await requireNightAccess(formData.get('nightId'), 'run')
  const game = readGame(formData)
  if (!game) return
  await upsertNightGame(nightId, game, viewer.id)
  refresh()
}

export async function removeNightGame(formData: FormData) {
  const { nightId } = await requireNightAccess(formData.get('nightId'), 'run')
  const gameId = parseUuid(formData.get('gameId'))
  if (!gameId) return
  await db.delete(nightGames).where(and(eq(nightGames.id, gameId), eq(nightGames.gameNightId, nightId)))
  refresh()
}

export async function addGameOption(formData: FormData) {
  const { nightId, viewer } = await requireNightAccess(formData.get('nightId'), 'run')
  const game = readGame(formData)
  if (!game) return
  await db
    .insert(gameOptions)
    .values({ gameNightId: nightId, name: game.name, coverUrl: game.coverUrl, source: game.source, externalId: game.externalId, suggestedBy: viewer.id })
    .onConflictDoNothing()
  refresh()
}

export async function removeGameOption(formData: FormData) {
  const { nightId } = await requireNightAccess(formData.get('nightId'), 'run')
  const optionId = parseUuid(formData.get('optionId'))
  if (!optionId) return
  await db.transaction(async (tx) => {
    await tx.delete(gameVotes).where(eq(gameVotes.gameOptionId, optionId))
    await tx.delete(gameOptions).where(and(eq(gameOptions.id, optionId), eq(gameOptions.gameNightId, nightId)))
  })
  refresh()
}

export async function lockInGame(formData: FormData) {
  const { nightId, viewer } = await requireNightAccess(formData.get('nightId'), 'run')
  const optionId = parseUuid(formData.get('optionId'))
  if (!optionId) return
  const [option] = await db.select().from(gameOptions).where(eq(gameOptions.id, optionId)).limit(1)
  if (!option || option.gameNightId !== nightId) return
  await db.update(gameNights).set({ game: option.name, gameVotingOpen: false }).where(eq(gameNights.id, nightId))
  const picked: PickedGame = {
    source: option.source === 'rawg' ? 'rawg' : 'custom',
    externalId: option.externalId ?? customGame(option.name).externalId,
    name: option.name,
    coverUrl: option.coverUrl,
    backgroundUrl: option.coverUrl,
    genres: [],
    platforms: [],
  }
  await upsertNightGame(nightId, picked, viewer.id)
  refresh()
}

function readActivity(formData: FormData) {
  const toInt = (value: FormDataEntryValue | null, fallback: number, max: number) => {
    const number = Number(typeof value === 'string' ? value : NaN)
    return Number.isInteger(number) && number >= 0 && number <= max ? number : fallback
  }
  return {
    title: parseText(formData.get('title'), 100),
    type: oneOf(formData.get('type'), ['game', 'break', 'intro', 'tournament', 'custom'] as const, 'custom'),
    gameName: parseText(formData.get('gameName'), 80) || null,
    startOffset: toInt(formData.get('startOffset'), 0, 1440),
    duration: Math.max(toInt(formData.get('duration'), 30, 720), 5),
    description: parseText(formData.get('description'), 600),
    discordChannel: parseText(formData.get('discordChannel'), 60) || null,
  }
}

async function setActivityHosts(activityId: string, formData: FormData) {
  const ids = [...new Set(formData.getAll('hostIds').filter((value): value is string => typeof value === 'string').map((value) => value.slice(0, 100)))].slice(0, 10)
  await db.delete(activityHosts).where(eq(activityHosts.activityId, activityId))
  if (ids.length) await db.insert(activityHosts).values(ids.map((userId) => ({ activityId, userId })))
}

export async function saveActivity(formData: FormData) {
  const { nightId } = await requireNightAccess(formData.get('nightId'), 'run')
  const details = readActivity(formData)
  if (!details.title) return
  const activityId = parseUuid(formData.get('activityId'))
  const [night] = await db.select({ id: gameNights.id }).from(gameNights).where(eq(gameNights.id, nightId)).limit(1)
  if (!night) return

  if (activityId) {
    const updated = await db
      .update(nightActivities)
      .set(details)
      .where(and(eq(nightActivities.id, activityId), eq(nightActivities.gameNightId, nightId)))
      .returning({ id: nightActivities.id })
    if (updated.length) await setActivityHosts(activityId, formData)
  } else {
    const [created] = await db.insert(nightActivities).values({ ...details, gameNightId: nightId }).returning({ id: nightActivities.id })
    await setActivityHosts(created.id, formData)
  }
  refresh()
}

export async function removeActivity(formData: FormData) {
  const { nightId } = await requireNightAccess(formData.get('nightId'), 'run')
  const activityId = parseUuid(formData.get('activityId'))
  if (!activityId) return
  await db.transaction(async (tx) => {
    await tx.delete(activityHosts).where(eq(activityHosts.activityId, activityId))
    await tx.delete(nightActivities).where(and(eq(nightActivities.id, activityId), eq(nightActivities.gameNightId, nightId)))
  })
  refresh()
}

export async function inviteHost(formData: FormData) {
  const { nightId, viewer } = await requireNightAccess(formData.get('nightId'), 'run')
  const userId = parseText(formData.get('userId'), 100)
  if (!userId) return
  const role = oneOf(formData.get('role'), ['lead', 'co', 'coordinator', 'custom'] as const, 'co')
  const customRole = role === 'custom' ? parseText(formData.get('customRole'), 40) || 'Helper' : null
  const responsibilities = parseText(formData.get('responsibilities'), 400)
  const self = userId === viewer.id
  const [night] = await db.select().from(gameNights).where(eq(gameNights.id, nightId)).limit(1)
  if (!night) return

  await db
    .insert(nightHosts)
    .values({
      gameNightId: nightId,
      userId,
      role,
      customRole,
      responsibilities,
      invitedBy: viewer.id,
      status: self ? 'accepted' : 'pending',
      respondedAt: self ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: [nightHosts.gameNightId, nightHosts.userId],
      set: { role, customRole, responsibilities, invitedBy: viewer.id },
    })
  if (!self) {
    await notify([
      {
        userId,
        type: 'host_invite',
        gameNightId: nightId,
        title: `${viewer.name} invited you to help host ${night.title}`,
        body: responsibilities || 'Open the night to accept or decline.',
        href: `/game-nights/${nightId}`,
        dedupeKey: `host:${nightId}:${Date.now()}`,
      },
    ])
  }
  refresh()
}

export async function removeHost(formData: FormData) {
  const { nightId } = await requireNightAccess(formData.get('nightId'), 'run')
  const userId = parseText(formData.get('userId'), 100)
  if (!userId) return
  await db.transaction(async (tx) => {
    await tx.delete(nightHosts).where(and(eq(nightHosts.gameNightId, nightId), eq(nightHosts.userId, userId)))
    await tx.execute(
      sql`delete from ${activityHosts} where user_id = ${userId} and activity_id in (select id from ${nightActivities} where game_night_id = ${nightId})`,
    )
  })
  refresh()
}

export async function toggleCheckIn(formData: FormData) {
  const { nightId } = await requireNightAccess(formData.get('nightId'), 'run')
  const userId = parseText(formData.get('userId'), 100)
  if (!userId) return
  const [row] = await db.select().from(rsvps).where(and(eq(rsvps.gameNightId, nightId), eq(rsvps.userId, userId))).limit(1)
  if (!row) return
  await db
    .update(rsvps)
    .set({ checkedInAt: row.checkedInAt ? null : new Date() })
    .where(and(eq(rsvps.gameNightId, nightId), eq(rsvps.userId, userId)))
  refresh()
}

export async function removeAttendee(formData: FormData) {
  const { nightId } = await requireNightAccess(formData.get('nightId'), 'run')
  const userId = parseText(formData.get('userId'), 100)
  if (!userId) return
  await db.delete(rsvps).where(and(eq(rsvps.gameNightId, nightId), eq(rsvps.userId, userId)))
  await promoteWaitlist(nightId)
  refresh()
}

const INTERVAL_DAYS = { weekly: 7, biweekly: 14 } as const

function nextOccurrence(date: Date, recurrence: string) {
  const next = new Date(date)
  if (recurrence === 'monthly') next.setMonth(next.getMonth() + 1)
  else next.setDate(next.getDate() + (INTERVAL_DAYS[recurrence as keyof typeof INTERVAL_DAYS] ?? 7))
  return next
}

async function cloneNight(sourceId: string, adminId: string, options: { startsAt: Date | null; template: boolean; seriesId: string | null; titleSuffix?: string }) {
  const [source] = await db.select().from(gameNights).where(eq(gameNights.id, sourceId)).limit(1)
  if (!source) return null
  const [copy] = await db
    .insert(gameNights)
    .values({
      userId: adminId,
      title: `${source.title}${options.titleSuffix ?? ''}`.slice(0, 100),
      description: source.description,
      bannerUrl: source.bannerUrl,
      discordUrl: source.discordUrl,
      capacity: source.capacity,
      waitlistEnabled: source.waitlistEnabled,
      rsvpQuestion: source.rsvpQuestion,
      gameVoteMode: source.gameVoteMode,
      recurrence: source.recurrence,
      game: source.game,
      startsAt: options.startsAt,
      status: 'draft',
      isTemplate: options.template,
      seriesId: options.seriesId,
    })
    .returning({ id: gameNights.id })

  const [games, activities] = await Promise.all([
    db.select().from(nightGames).where(eq(nightGames.gameNightId, sourceId)),
    db.select().from(nightActivities).where(eq(nightActivities.gameNightId, sourceId)),
  ])
  if (games.length) {
    await db.insert(nightGames).values(games.map(({ id: _id, createdAt: _createdAt, ...game }) => ({ ...game, gameNightId: copy.id })))
  }
  if (activities.length) {
    await db.insert(nightActivities).values(activities.map(({ id: _id, createdAt: _createdAt, ...activity }) => ({ ...activity, gameNightId: copy.id })))
  }
  return copy.id
}

export async function duplicateNight(formData: FormData) {
  const { nightId, viewer } = await requireNightAccess(formData.get('nightId'), 'admin')
  const mode = oneOf(formData.get('mode'), ['copy', 'template', 'next'] as const, 'copy')
  const [source] = await db.select().from(gameNights).where(eq(gameNights.id, nightId)).limit(1)
  if (!source) return

  let copyId: string | null = null
  if (mode === 'template') {
    copyId = await cloneNight(nightId, viewer.id, { startsAt: null, template: true, seriesId: null })
  } else if (mode === 'next') {
    const seriesId = source.seriesId ?? crypto.randomUUID()
    if (!source.seriesId) await db.update(gameNights).set({ seriesId }).where(eq(gameNights.id, nightId))
    const startsAt = source.startsAt && source.recurrence !== 'none' ? nextOccurrence(source.startsAt, source.recurrence) : null
    copyId = await cloneNight(nightId, viewer.id, { startsAt, template: false, seriesId })
  } else {
    copyId = await cloneNight(nightId, viewer.id, { startsAt: null, template: false, seriesId: null, titleSuffix: ' (copy)' })
  }
  refresh()
  if (copyId) redirect(`/admin/game-nights/${copyId}`)
}

export async function createFromTemplate(formData: FormData) {
  const admin = await requireAdmin()
  const templateId = parseUuid(formData.get('templateId'))
  if (!templateId) return
  const copyId = await cloneNight(templateId, admin.id, { startsAt: parseDate(formData.get('startsAt')), template: false, seriesId: null })
  refresh()
  if (copyId) redirect(`/admin/game-nights/${copyId}`)
}

export async function deleteGameNight(formData: FormData) {
  const { nightId } = await requireNightAccess(formData.get('id'), 'admin')
  await db.transaction(async (tx) => {
    await tx.execute(sql`delete from ${dateVotes} where date_option_id in (select id from ${dateOptions} where game_night_id = ${nightId})`)
    await tx.execute(sql`delete from ${activityHosts} where activity_id in (select id from ${nightActivities} where game_night_id = ${nightId})`)
    await tx.delete(dateOptions).where(eq(dateOptions.gameNightId, nightId))
    await tx.delete(gameVotes).where(eq(gameVotes.gameNightId, nightId))
    await tx.delete(gameOptions).where(eq(gameOptions.gameNightId, nightId))
    await tx.delete(nightGames).where(eq(nightGames.gameNightId, nightId))
    await tx.delete(nightActivities).where(eq(nightActivities.gameNightId, nightId))
    await tx.delete(nightHosts).where(eq(nightHosts.gameNightId, nightId))
    await tx.delete(rsvps).where(eq(rsvps.gameNightId, nightId))
    await tx.delete(gameNights).where(eq(gameNights.id, nightId))
  })
  refresh()
  redirect('/admin?deleted=1')
}

export async function grantAdmin(formData: FormData) {
  const owner = await requireOwner()
  const email = parseText(formData.get('email'), 254).toLowerCase()
  if (!email) redirect('/admin?team=missing')
  const result = await db.execute<{ id: string }>(sql`select id::text as id from neon_auth."user" where lower(email) = ${email} limit 1`)
  const target = result.rows[0]
  if (!target) redirect('/admin?team=notfound')
  await db.insert(memberRoles).values({ userId: target.id, role: 'admin', grantedBy: owner.id }).onConflictDoNothing()
  refresh()
  redirect('/admin?team=added')
}

export async function revokeAdmin(formData: FormData) {
  await requireOwner()
  const userId = parseText(formData.get('userId'), 100)
  if (!userId) return
  const [target] = await db.select().from(memberRoles).where(eq(memberRoles.userId, userId)).limit(1)
  if (!target || target.role === 'owner') return
  await db.delete(memberRoles).where(eq(memberRoles.userId, userId))
  refresh()
  redirect('/admin?team=removed')
}
