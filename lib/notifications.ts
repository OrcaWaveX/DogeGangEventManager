import 'server-only'
import { and, count, desc, eq, gt, isNull, lt, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { gameNights, notifications, rsvps } from '@/lib/db/schema'

type NewNotification = {
  userId: string
  type: string
  gameNightId?: string
  title: string
  body?: string
  href?: string
  dedupeKey?: string
}

export async function notify(items: NewNotification[]) {
  if (!items.length) return
  try {
    await db
      .insert(notifications)
      .values(items.map((item) => ({ ...item, body: item.body ?? '', gameNightId: item.gameNightId ?? null, href: item.href ?? null, dedupeKey: item.dedupeKey ?? null })))
      .onConflictDoNothing()
  } catch (error) {
    console.error('[v0] Could not create notifications', error instanceof Error ? error.message : 'Unknown failure')
  }
}

export async function unreadCount(userId: string) {
  try {
    const [row] = await db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    return row?.n ?? 0
  } catch {
    return 0
  }
}

export async function listNotifications(userId: string) {
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(60)
}

const DAY = 24 * 60 * 60 * 1000

export async function syncReminders(userId: string) {
  try {
    const now = new Date()
    const rows = await db
      .select({ id: gameNights.id, title: gameNights.title, startsAt: gameNights.startsAt, status: rsvps.status })
      .from(rsvps)
      .innerJoin(gameNights, eq(gameNights.id, rsvps.gameNightId))
      .where(
        and(
          eq(rsvps.userId, userId),
          sql`${rsvps.status} in ('going', 'maybe')`,
          eq(gameNights.status, 'published'),
          gt(gameNights.startsAt, now),
          lt(gameNights.startsAt, new Date(now.getTime() + 2 * DAY)),
        ),
      )
    await notify(
      rows.map((row) => {
        const soon = row.startsAt!.getTime() - now.getTime() <= 3 * 60 * 60 * 1000
        return {
          userId,
          type: 'reminder',
          gameNightId: row.id,
          title: soon ? `${row.title} starts soon` : `${row.title} is coming up`,
          body: soon ? 'Starting in a few hours.' : 'Starting within the next day or two.',
          href: `/game-nights/${row.id}`,
          dedupeKey: `reminder:${row.id}:${soon ? 'soon' : 'day'}`,
        }
      }),
    )
  } catch (error) {
    console.error('[v0] Could not sync reminders', error instanceof Error ? error.message : 'Unknown failure')
  }
}
