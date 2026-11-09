export type NightPhase = 'draft' | 'cancelled' | 'upcoming' | 'live' | 'completed' | 'unscheduled'

const DEFAULT_LENGTH_MINUTES = 180

export function phaseOf(
  night: { status: string; startsAt: Date | null },
  lengthMinutes: number = DEFAULT_LENGTH_MINUTES,
  now: number = Date.now(),
): NightPhase {
  if (night.status === 'draft') return 'draft'
  if (night.status === 'cancelled') return 'cancelled'
  if (night.status === 'archived') return 'completed'
  if (!night.startsAt) return 'unscheduled'
  const start = night.startsAt.getTime()
  const end = start + Math.max(lengthMinutes, 60) * 60000
  if (now < start) return 'upcoming'
  if (now <= end) return 'live'
  return 'completed'
}

export const phaseLabels: Record<NightPhase, string> = {
  draft: 'Draft',
  cancelled: 'Cancelled',
  upcoming: 'Upcoming',
  live: 'Live now',
  completed: 'Completed',
  unscheduled: 'Date TBD',
}
