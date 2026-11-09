import Link from 'next/link'
import { ArrowRight, CalendarDays, Gamepad2, Users } from 'lucide-react'
import { LocalTime } from '@/components/local-time'
import type { NightSummary } from '@/lib/game-nights'
import { phaseLabels, phaseOf } from '@/lib/night-phase'
import { cn } from '@/lib/utils'

export function NightChips({ night }: { night: NightSummary }) {
  const phase = phaseOf(night, night.lengthMinutes)
  return (
    <div className="chips">
      <span className={cn('chip', phase === 'live' && 'chip-live', phase === 'draft' && 'chip-draft', phase === 'cancelled' && 'chip-cancelled')}>
        {phaseLabels[phase]}
      </span>
      {night.isTemplate && <span className="chip">Template</span>}
      {night.schedulingOpen && <span className="chip chip-live">Date poll open</span>}
      {night.gameVotingOpen && <span className="chip chip-live">Game vote open</span>}
    </div>
  )
}

export function NightCard({ night, featured = false, href, myStatus }: { night: NightSummary; featured?: boolean; href?: string; myStatus?: string }) {
  const games = night.gameNames.length ? night.gameNames.slice(0, 3).join(', ') : night.game
  return (
    <article className={cn('night-card', featured && 'featured rainbow-card')}>
      {night.art ? <img src={night.art} alt="" className="night-card-banner" /> : <div className="night-card-banner-empty" aria-hidden="true" />}
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
            {games || 'Game to be decided'}
          </span>
          <span>
            <Users size={15} aria-hidden="true" />
            {night.going} going{night.capacity ? ` of ${night.capacity}` : ''}
            {myStatus === 'waitlist' ? ' · You are on the waitlist' : myStatus === 'maybe' ? ' · You said maybe' : myStatus === 'going' ? ' · You are going' : ''}
          </span>
        </div>
        <Link
          href={href ?? `/game-nights/${night.id}`}
          className="relative mt-auto inline-flex items-center gap-2 pt-2 text-sm font-semibold after:absolute after:inset-0"
        >
          Open game night <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </article>
  )
}
