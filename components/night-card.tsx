import Link from 'next/link'
import { ArrowRight, CalendarDays, Gamepad2, Users } from 'lucide-react'
import { LocalTime } from '@/components/local-time'
import type { NightSummary } from '@/lib/game-nights'

export function NightChips({ night }: { night: NightSummary }) {
  return (
    <div className="chips">
      {night.status === 'draft' && <span className="chip chip-draft">Draft</span>}
      {night.status === 'archived' && <span className="chip">Archived</span>}
      {night.schedulingOpen && <span className="chip chip-live">Date poll open</span>}
      {night.gameVotingOpen && <span className="chip chip-live">Game vote open</span>}
    </div>
  )
}

export function NightCard({ night, featured = false, href }: { night: NightSummary; featured?: boolean; href?: string }) {
  return (
    <article className={`night-card ${featured ? 'featured rainbow-card' : ''}`}>
      {night.bannerUrl ? (
        <img src={night.bannerUrl} alt="" className="night-card-banner" />
      ) : (
        <div className="night-card-banner-empty" aria-hidden="true" />
      )}
      <div className="night-card-body">
        {featured && <span className="eyebrow">Next up</span>}
        <NightChips night={night} />
        <h3>{night.title}</h3>
        <div className="night-meta">
          <span>
            <CalendarDays size={15} aria-hidden="true" />
            {night.startsAt ? <LocalTime iso={night.startsAt.toISOString()} /> : 'Date to be decided'}
          </span>
          <span>
            <Gamepad2 size={15} aria-hidden="true" />
            {night.game || 'Game to be decided'}
          </span>
          <span>
            <Users size={15} aria-hidden="true" />
            {night.going} going{night.capacity ? ` of ${night.capacity}` : ''}
          </span>
        </div>
        <Link
          href={href ?? `/game-nights/${night.id}`}
          className="mt-auto inline-flex items-center gap-2 pt-2 text-sm font-semibold after:absolute after:inset-0 relative"
        >
          Open game night <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </article>
  )
}
