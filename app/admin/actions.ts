'use server'

import { eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { dateOptions, dateVotes, gameNights, gameOptions, gameVotes, memberRoles, rsvps } from '@/lib/db/schema'
import { requireAdmin, requireOwner } from '@/lib/session'
import { parseCapacity, parseDate, parseHttpsUrl, parseText, parseUuid } from '@/lib/validation'

function refresh(nightId?: string) {
  revalidatePath('/')
  revalidatePath('/admin')
  if (nightId) {
    revalidatePath(`/game-nights/${nightId}`)
    revalidatePath(`/admin/game-nights/${nightId}`)
  }
}

function readDetails(formData: FormData) {
  return {
    title: parseText(formData.get('title'), 100),
    description: parseText(formData.get('description'), 2000),
    game: parseText(formData.get('game'), 60) || null,
    startsAt: parseDate(formData.get('startsAt')),
    capacity: parseCapacity(formData.get('capacity')),
    discordUrl: parseHttpsUrl(formData.get('discordUrl')),
    bannerUrl: parseHttpsUrl(formData.get('bannerUrl')),
  }
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
  await requireAdmin()
  const id = parseUuid(formData.get('id'))
  if (!id) return
  const details = readDetails(formData)
  if (!details.title) redirect(`/admin/game-nights/${id}?error=title`)
  await db
    .update(gameNights)
    .set({
      ...details,
      schedulingOpen: formData.get('schedulingOpen') === 'on',
      gameVotingOpen: formData.get('gameVotingOpen') === 'on',
    })
    .where(eq(gameNights.id, id))
  refresh(id)
  redirect(`/admin/game-nights/${id}?saved=1`)
}

export async function setNightStatus(formData: FormData) {
  await requireAdmin()
  const id = parseUuid(formData.get('id'))
  const status = formData.get('status')
  if (!id || (status !== 'draft' && status !== 'published' && status !== 'archived')) return
  await db.update(gameNights).set({ status }).where(eq(gameNights.id, id))
  refresh(id)
}

export async function addDateOption(formData: FormData) {
  await requireAdmin()
  const nightId = parseUuid(formData.get('nightId'))
  const startsAt = parseDate(formData.get('startsAt'))
  if (!nightId || !startsAt) return
  await db.insert(dateOptions).values({ gameNightId: nightId, startsAt })
  refresh(nightId)
}

export async function removeDateOption(formData: FormData) {
  await requireAdmin()
  const nightId = parseUuid(formData.get('nightId'))
  const optionId = parseUuid(formData.get('optionId'))
  if (!nightId || !optionId) return
  await db.transaction(async (tx) => {
    await tx.delete(dateVotes).where(eq(dateVotes.dateOptionId, optionId))
    await tx.delete(dateOptions).where(eq(dateOptions.id, optionId))
  })
  refresh(nightId)
}

export async function lockInDate(formData: FormData) {
  await requireAdmin()
  const nightId = parseUuid(formData.get('nightId'))
  const optionId = parseUuid(formData.get('optionId'))
  if (!nightId || !optionId) return
  const [option] = await db.select().from(dateOptions).where(eq(dateOptions.id, optionId)).limit(1)
  if (!option || option.gameNightId !== nightId) return
  await db.update(gameNights).set({ startsAt: option.startsAt, schedulingOpen: false }).where(eq(gameNights.id, nightId))
  refresh(nightId)
}

export async function addGameOption(formData: FormData) {
  const admin = await requireAdmin()
  const nightId = parseUuid(formData.get('nightId'))
  const name = parseText(formData.get('name'), 60)
  if (!nightId || !name) return
  await db.insert(gameOptions).values({ gameNightId: nightId, name, suggestedBy: admin.id }).onConflictDoNothing()
  refresh(nightId)
}

export async function removeGameOption(formData: FormData) {
  await requireAdmin()
  const nightId = parseUuid(formData.get('nightId'))
  const optionId = parseUuid(formData.get('optionId'))
  if (!nightId || !optionId) return
  await db.transaction(async (tx) => {
    await tx.delete(gameVotes).where(eq(gameVotes.gameOptionId, optionId))
    await tx.delete(gameOptions).where(eq(gameOptions.id, optionId))
  })
  refresh(nightId)
}

export async function lockInGame(formData: FormData) {
  await requireAdmin()
  const nightId = parseUuid(formData.get('nightId'))
  const optionId = parseUuid(formData.get('optionId'))
  if (!nightId || !optionId) return
  const [option] = await db.select().from(gameOptions).where(eq(gameOptions.id, optionId)).limit(1)
  if (!option || option.gameNightId !== nightId) return
  await db.update(gameNights).set({ game: option.name, gameVotingOpen: false }).where(eq(gameNights.id, nightId))
  refresh(nightId)
}

export async function deleteGameNight(formData: FormData) {
  await requireAdmin()
  const id = parseUuid(formData.get('id'))
  if (!id) return
  await db.transaction(async (tx) => {
    await tx.execute(sql`delete from ${dateVotes} where date_option_id in (select id from ${dateOptions} where game_night_id = ${id})`)
    await tx.delete(dateOptions).where(eq(dateOptions.gameNightId, id))
    await tx.delete(gameVotes).where(eq(gameVotes.gameNightId, id))
    await tx.delete(gameOptions).where(eq(gameOptions.gameNightId, id))
    await tx.delete(rsvps).where(eq(rsvps.gameNightId, id))
    await tx.delete(gameNights).where(eq(gameNights.id, id))
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
  await db
    .insert(memberRoles)
    .values({ userId: target.id, role: 'admin', grantedBy: owner.id })
    .onConflictDoNothing()
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
