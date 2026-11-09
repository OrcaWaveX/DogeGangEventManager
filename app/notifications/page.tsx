import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LocalTime } from '@/components/local-time'
import { markNotificationsRead } from '@/app/game-nights/actions'
import { listNotifications, syncReminders } from '@/lib/notifications'
import { getViewer } from '@/lib/session'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Notifications | DogeGang+' }

export default async function NotificationsPage() {
  const viewer = await getViewer()
  if (!viewer) redirect('/auth/sign-in')
  await syncReminders(viewer.id)
  const items = await listNotifications(viewer.id)
  const hasUnread = items.some((item) => !item.readAt)

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Inbox</span>
          <h1>Notifications</h1>
          <p>New game nights, host invites, date changes and reminders.</p>
        </div>
        {hasUnread && (
          <form action={markNotificationsRead}>
            <Button type="submit" variant="outline">
              Mark all as read
            </Button>
          </form>
        )}
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <Bell className="mx-auto mb-3" aria-hidden="true" />
          <h2>You are all caught up</h2>
          <p>We will let you know when something changes.</p>
        </div>
      ) : (
        <ul className="admin-list">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href ?? '/'} className={cn('admin-row', !item.readAt && 'is-unread')}>
                <div>
                  <strong>{item.title}</strong>
                  {item.body && <span className="small-copy">{item.body}</span>}
                </div>
                <span className="small-copy">
                  <LocalTime iso={item.createdAt.toISOString()} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
