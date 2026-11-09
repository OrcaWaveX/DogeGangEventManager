'use server'

import { and, count, eq, isNull, ne, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { promoteWaitlist } from '@/app/admin/actions'
import { db } from '@/lib/db'
import { dateOptions, dateVotes, gameNights, gameOptions, gameVotes, nightHosts, notifications, rsvps, userGames } from '@/lib/db/schema'
import { customGame, parsePickedGame } from '@/lib/games'
import { notify } from '@/lib/notifications'
import { requireViewer } from '@/lib/session'
import { parseText, parseUuid } from '@/lib/validation'

async function loadOpenNight(nightId: string) {
  const [night] = await db.select().from(gameNights).where(eq(gameNights.id, nightId)).limit(1)
  return night?.status === 'published' ? night : null
}

function refresh() {
  revalidatePath('/', 'layout')
}

const pastDeadline = (deadline: Date | null) => deadline !== null && deadline.getTime() < Date.now()

export async function setRsvp(formData: FormData) {
  const viewer = await requireViewer()
  const nightId = parseUuid(formData.get('nightId'))
  const requested = formData.get('status')
  if (!nightId || (requested !== 'going' && requested !== 'maybe' && requested !== 'not_going')) return
  const night = await loadOpenNight(nightId)
  if (!night) return

  const [existing] = await db.select().from(rsvps).where(and(eq(rsvps.gameNightId, nightId), eq(rsvps.userId, viewer.id))).limit(1)
  if (pastDeadline(night.rsvpDeadline) && !existing) return
  if (pastDeadline(night.rsvpDeadline) && requested === 'going' && existing?.status !== 'going') return

  let status: 'going' | 'maybe' | 'not_going' | 'waitlist' = requested
  if (requested === 'going' && night.capacity && existing?.status !== 'going') {
    const [{ total }] = await db
      .select({ total: count() })
      .from(rsvps)
      .where(and(eq(rsvps.gameNightId, nightId), eq(rsvps.status, 'going'), ne(rsvps.userId, viewer.id)))
    if (total >= night.capacity) {
      if (!night.waitlistEnabled) return
      status = 'waitlist'
    }
  }

  const answer = night.rsvpQuestion ? parseText(formData.get('answer'), 200) || null : null
  await db
    .insert(rsvps)
    .values({ gameNightId: nightId, userId: viewer.id, status, answer })
    .onConflictDoUpdate({
      target: [rsvps.gameNightId, rsvps.userId],
      set: { status, updatedAt: new Date(), ...(night.rsvpQuestion ? { answer } : {}) },
    })
  if (existing?.status === 'going' && status !== 'going') await promoteWaitlist(nightId)
  refresh()
}

export async function voteDate(formData: FormData) {
  const viewer = await requireViewer()
  const nightId = parseUuid(formData.get('nightId'))
  const optionId = parseUuid(formData.get('optionId'))
  const response = formData.get('response')
  if (!nightId || !optionId || (response !== 'available' && response !== 'maybe' && response !== 'unavailable')) return
  const night = await loadOpenNight(nightId)
  if (!night?.schedulingOpen || pastDeadline(night.schedulingDeadline)) return
  const [option] = await db
    .select({ id: dateOptions.id })
    .from(dateOptions)
    .where(and(eq(dateOptions.id, optionId), eq(dateOptions.gameNightId, nightId)))
    .limit(1)
  if (!option) return

  await db
    .insert(dateVotes)
    .values({ dateOptionId: optionId, userId: viewer.id, response })
    .onConflictDoUpdate({ target: [dateVotes.dateOptionId, dateVotes.userId], set: { response, updatedAt: new Date() } })
  refresh()
}

export async function voteGame(formData: FormData) {
  const viewer = await requireViewer()
  const nightId = parseUuid(formData.get('nightId'))
  const optionId = parseUuid(formData.get('optionId'))
  if (!nightId || !optionId) return
  const night = await loadOpenNight(nightId)
  if (!night?.gameVotingOpen || pastDeadline(night.gameVotingDeadline)) return
  const [option] = await db
    .select({ id: gameOptions.id })
    .from(gameOptions)
    .where(and(eq(gameOptions.id, optionId), eq(gameOptions.gameNightId, nightId)))
    .limit(1)
  if (!option) return

  const [existing] = await db
    .select()
    .from(gameVotes)
    .where(and(eq(gameVotes.gameOptionId, optionId), eq(gameVotes.userId, viewer.id)))
    .limit(1)

  if (night.gameVoteMode === 'multi') {
    if (existing) await db.delete(gameVotes).where(and(eq(gameVotes.gameOptionId, optionId), eq(gameVotes.userId, viewer.id)))
    else await db.insert(gameVotes).values({ gameNightId: nightId, userId: viewer.id, gameOptionId: optionId })
  } else {
    await db.transaction(async (tx) => {
      await tx.delete(gameVotes).where(and(eq(gameVotes.gameNightId, nightId), eq(gameVotes.userId, viewer.id)))
      if (!existing) await tx.insert(gameVotes).values({ gameNightId: nightId, userId: viewer.id, gameOptionId: optionId })
    })
  }
  refresh()
}

export async function suggestGame(formData: FormData) {
  const viewer = await requireViewer()
  const nightId = parseUuid(formData.get('nightId'))
  if (!nightId) return
  const night = await loadOpenNight(nightId)
  if (!night?.gameVotingOpen || pastDeadline(night.gameVotingDeadline)) return

  let game = null
  const raw = formData.get('game')
  if (typeof raw === 'string' && raw) {
    try {
      game = parsePickedGame(JSON.parse(raw))
    } catch {
      game = null
    }
  } else {
    const name = parseText(formData.get('name'), 80)
    game = name ? customGame(name) : null
  }
  if (!game) return

  await db
    .insert(gameOptions)
    .values({ gameNightId: nightId, name: game.name, coverUrl: game.coverUrl, source: game.source, externalId: game.externalId, suggestedBy: viewer.id })
    .onConflictDoNothing()
  refresh()
}

export async function respondToHostInvite(formData: FormData) {
  const viewer = await requireViewer()
  const nightId = parseUuid(formData.get('nightId'))
  const accept = formData.get('decision') === 'accept'
  if (!nightId) return
  const [invite] = await db
    .select()
    .from(nightHosts)
    .where(and(eq(nightHosts.gameNightId, nightId), eq(nightHosts.userId, viewer.id), eq(nightHosts.status, 'pending')))
    .limit(1)
  if (!invite) return
  await db
    .update(nightHosts)
    .set({ status: accept ? 'accepted' : 'declined', respondedAt: new Date() })
    .where(eq(nightHosts.id, invite.id))
  if (invite.invitedBy && invite.invitedBy !== viewer.id) {
    const [night] = await db.select({ title: gameNights.title }).from(gameNights).where(eq(gameNights.id, nightId)).limit(1)
    await notify([
      {
        userId: invite.invitedBy,
        type: 'host_response',
        gameNightId: nightId,
        title: `${viewer.name} ${accept ? 'accepted' : 'declined'} hosting ${night?.title ?? 'your night'}`,
        href: `/admin/game-nights/${nightId}`,
        dedupeKey: `hostresp:${invite.id}:${accept}`,
      },
    ])
  }
  refresh()
}

export async function toggleFavoriteGame(formData: FormData) {
  const viewer = await requireViewer()
  const source = formData.get('source') === 'rawg' ? 'rawg' : 'custom'
  const externalId = parseText(formData.get('externalId'), 80)
  if (!externalId) return
  await db
    .update(userGames)
    .set({ favorite: sql`not ${userGames.favorite}` })
    .where(and(eq(userGames.userId, viewer.id), eq(userGames.source, source), eq(userGames.externalId, externalId)))
  refresh()
}

export async function markNotificationsRead() {
  const viewer = await requireViewer()
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, viewer.id), isNull(notifications.readAt)))
  refresh()
}
