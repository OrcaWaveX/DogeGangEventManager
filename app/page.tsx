import Link from 'next/link'
import { CalendarDays, Plus } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { NightCard } from '@/components/night-card'
import { listPublishedNights, type NightSummary } from '@/lib/game-nights'
import { getViewer, isAdmin } from '@/lib/session'

export const dynamic = 'force-dynamic'

const SIX_HOURS = 6 * 60 * 60 * 1000

export default async function HomePage() {
  const viewer = await getViewer()
  let nights: NightSummary[] = []
  let failed = false
  try {
    nights = await listPublishedNights()
  } catch (error) {
    console.error('[v0] Failed to load game nights', error instanceof Error ? error.message : 'Unknown failure')
    failed = true
  }

  const cutoff = Date.now() - SIX_HOURS
  const upcoming = nights.filter((night) => !night.startsAt || night.startsAt.getTime() >= cutoff)
  const past = nights.filter((night) => night.startsAt && night.startsAt.getTime() < cutoff).reverse()
  const [next, ...later] = upcoming

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <span className="eyebrow">DogeGang+</span>
          <h1>Game nights</h1>
          <p>RSVP, pick a date and vote on what we play. All in one place.</p>
        </div>
        {isAdmin(viewer) && (
          <Link href="/admin" className={cn(buttonVariants(), 'btn-rainbow')}>
            <Plus aria-hidden="true" /> Manage game nights
          </Link>
        )}
      </div>

      {!viewer && (
        <div className="callout">
          <span>Sign in to RSVP, vote on dates and games, and see who else is coming.</span>
          <Link href="/auth/sign-in">Sign in</Link>
        </div>
      )}

      {failed ? (
        <div className="empty-state">
          <h2>Could not load game nights</h2>
          <p>Refresh the page to try again.</p>
        </div>
      ) : upcoming.length === 0 ? (
        <div className="empty-state">
          <CalendarDays className="mx-auto mb-3" aria-hidden="true" />
          <h2>No game nights scheduled</h2>
          <p>{isAdmin(viewer) ? 'Create one from the admin page and publish it when it is ready.' : 'Check back soon. Admins will post the next one here.'}</p>
        </div>
      ) : (
        <>
          {next && <NightCard night={next} featured />}
          {later.length > 0 && (
            <section aria-labelledby="later-heading">
              <div className="section-heading">
                <h2 id="later-heading">Coming up</h2>
              </div>
              <div className="night-grid">
                {later.map((night) => (
                  <NightCard key={night.id} night={night} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {past.length > 0 && (
        <section aria-labelledby="past-heading">
          <div className="section-heading">
            <h2 id="past-heading">Past game nights</h2>
          </div>
          <div className="night-grid">
            {past.map((night) => (
              <NightCard key={night.id} night={night} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
