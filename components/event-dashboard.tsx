import Link from 'next/link'
import { ArrowRight, CalendarDays, Gamepad2, Vote } from 'lucide-react'
import { db } from '@/lib/db'
import { gameNights } from '@/lib/db/schema'
import { and, eq, gte, isNull, or, asc } from 'drizzle-orm'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'

const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })

export async function EventDashboard({ compact = false }: { compact?: boolean }) {
  let events: (typeof gameNights.$inferSelect)[] = []
  let failed = false
  try {
    events = await db
      .select()
      .from(gameNights)
      .where(and(eq(gameNights.status, 'published'), or(isNull(gameNights.startsAt), gte(gameNights.startsAt, new Date()))))
      .orderBy(asc(gameNights.startsAt))
      .limit(50)
  } catch (error) {
    console.error('[v0] Failed to load game nights', error instanceof Error ? error.message : 'Unknown failure')
    failed = true
  }
  const polls = events.filter((event) => event.schedulingOpen || event.gameVotingOpen)

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <h1>{compact ? 'Game nights' : 'Upcoming game nights'}</h1>
          <p>Scheduled events and open polls.</p>
        </div>
      </div>
      <div className="overview-strip">
        <div>
          <span className="stat-icon"><CalendarDays /></span>
          <div><strong>{failed ? '—' : events.length}</strong><span>Upcoming game nights</span></div>
        </div>
        <div>
          <span className="stat-icon"><Vote /></span>
          <div><strong>{failed ? '—' : polls.length}</strong><span>Open polls</span></div>
        </div>
      </div>
      <div className="dashboard-columns">
        <section id="upcoming">
          <div className="section-heading">
            <div><h2>Schedule <span>{events.length}</span></h2></div>
            {!compact && <Link href="/game-nights">All game nights <ArrowRight size={15} /></Link>}
          </div>
          {events.length ? (
            <div className="event-list">
              {events.map((event) => (
                <article key={event.id} className="event-card">
                  <Gamepad2 />
                  <div>
                    <h3>{event.title}</h3>
                    <p>
                      {event.game || 'Game to be decided'} · {event.startsAt ? `${dateFormat.format(event.startsAt)} UTC` : 'Date poll open'}
                    </p>
                    {event.description && <p>{event.description}</p>}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty className="event-empty">
              <EmptyHeader>
                <EmptyMedia variant="icon"><CalendarDays /></EmptyMedia>
                <EmptyTitle>{failed ? 'Could not load game nights' : 'No game nights scheduled'}</EmptyTitle>
                <EmptyDescription>
                  {failed ? 'Refresh the page to try again.' : 'Published events will appear here.'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>
        <aside className="right-rail">
          <section className="rail-card">
            <div className="rail-icon"><Vote size={18} /></div>
            <h3>Open polls</h3>
            <span className="quiet-label">{polls.length ? `${polls.length} open` : 'None right now'}</span>
          </section>
        </aside>
      </div>
    </div>
  )
}
