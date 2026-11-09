'use server'

import { and, count, eq, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { dateOptions, dateVotes, gameNights, gameOptions, gameVotes, rsvps } from '@/lib/db/schema'
import { requireViewer } from '@/lib/session'
import { parseText, parseUuid } from '@/lib/validation'

async function loadPublishedNight(nightId: string) {
  const [night] = await db.select().from(gameNights).where(eq(gameNights.id, nightId)).limit(1)
  return night?.status === 'published' ? night : null
}

function refresh(nightId: string) {
  revalidatePath('/')
  revalidatePath(`/game-nights/${nightId}`)
}

export async function setRsvp(formData: FormData) {
  const viewer = await requireViewer()
  const nightId = parseUuid(formData.get('nightId'))
  const status = formData.get('status')
  if (!nightId || (status !== 'going' && status !== 'maybe' && status !== 'not_going')) return
  const night = await loadPublishedNight(nightId)
  if (!night) return

  if (status === 'going' && night.capacity) {
    const [{ total }] = await db
      .select({ total: count() })
      .from(rsvps)
      .where(and(eq(rsvps.gameNightId, nightId), eq(rsvps.status, 'going'), ne(rsvps.userId, viewer.id)))
    if (total >= night.capacity) return
  }

  await db
    .insert(rsvps)
    .values({ gameNightId: nightId, userId: viewer.id, status })
    .onConflictDoUpdate({ target: [rsvps.gameNightId, rsvps.userId], set: { status, updatedAt: new Date() } })
  refresh(nightId)
}

export async function voteDate(formData: FormData) {
  const viewer = await requireViewer()
  const nightId = parseUuid(formData.get('nightId'))
  const optionId = parseUuid(formData.get('optionId'))
  const response = formData.get('response')
  if (!nightId || !optionId || (response !== 'available' && response !== 'maybe' && response !== 'unavailable')) return
  const night = await loadPublishedNight(nightId)
  if (!night?.schedulingOpen) return
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
  refresh(nightId)
}

export async function voteGame(formData: FormData) {
  const viewer = await requireViewer()
  const nightId = parseUuid(formData.get('nightId'))
  const optionId = parseUuid(formData.get('optionId'))
  if (!nightId || !optionId) return
  const night = await loadPublishedNight(nightId)
  if (!night?.gameVotingOpen) return
  const [option] = await db
    .select({ id: gameOptions.id })
    .from(gameOptions)
    .where(and(eq(gameOptions.id, optionId), eq(gameOptions.gameNightId, nightId)))
    .limit(1)
  if (!option) return

  await db
    .insert(gameVotes)
    .values({ gameNightId: nightId, userId: viewer.id, gameOptionId: optionId })
    .onConflictDoUpdate({ target: [gameVotes.gameNightId, gameVotes.userId], set: { gameOptionId: optionId, updatedAt: new Date() } })
  refresh(nightId)
}

export async function suggestGame(formData: FormData) {
  const viewer = await requireViewer()
  const nightId = parseUuid(formData.get('nightId'))
  const name = parseText(formData.get('name'), 60)
  if (!nightId || !name) return
  const night = await loadPublishedNight(nightId)
  if (!night?.gameVotingOpen) return

  await db.insert(gameOptions).values({ gameNightId: nightId, name, suggestedBy: viewer.id }).onConflictDoNothing()
  refresh(nightId)
}
