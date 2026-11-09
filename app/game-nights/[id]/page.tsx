import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink, Settings } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LocalTime } from '@/components/local-time'
import { NightChips } from '@/components/night-card'
import { setRsvp, suggestGame, voteDate, voteGame } from '@/app/game-nights/actions'
import { getNightDetail } from '@/lib/game-nights'
import { getViewer, isAdmin } from '@/lib/session'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const rsvpChoices = [
  { value: 'going', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'not_going', label: "Can't go" },
] as const

const dateChoices = [
  { value: 'available', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'unavailable', label: 'No' },
] as const

export default async function GameNightPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const viewer = await getViewer()
  const detail = await getNightDetail(id, viewer?.id ?? null)
  if (!detail) notFound()
  const { night, dates, games, rsvp, attendees } = detail
  const admin = isAdmin(viewer)
  if (night.status !== 'published' && !admin) notFound()

  const full = Boolean(night.capacity && rsvp.going >= night.capacity)
  const maxVotes = Math.max(1, ...games.map((game) => game.votes))
  const summary = { ...night, going: rsvp.going }

  return (
    <div className="dashboard">
      <Link href="/" className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={15} aria-hidden="true" /> All game nights
      </Link>

      <div className="page-heading">
        <div className="flex flex-col gap-3">
          <NightChips night={summary} />
          <h1>{night.title}</h1>
          <p>
            {night.startsAt ? <LocalTime iso={night.startsAt.toISOString()} format="full" /> : 'Date to be decided'}
            {' · '}
            {night.game || 'Game to be decided'}
          </p>
        </div>
        {admin && (
          <Link href={`/admin/game-nights/${night.id}`} className={buttonVariants({ variant: 'outline' })}>
            <Settings aria-hidden="true" /> Manage
          </Link>
        )}
      </div>

      {night.bannerUrl && <img src={night.bannerUrl} alt="" className="detail-banner" />}

      {!viewer && (
        <div className="callout">
          <span>Sign in to RSVP and vote.</span>
          <Link href="/auth/sign-in">Sign in</Link>
        </div>
      )}

      <div className="detail-grid">
        <div className="stack">
          {night.description && (
            <section className="panel" aria-labelledby="about-heading">
              <h2 id="about-heading">About</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{night.description}</p>
            </section>
          )}

          {night.schedulingOpen && (
            <section className="panel" aria-labelledby="dates-heading">
              <h2 id="dates-heading">Which date works?</h2>
              {dates.length === 0 ? (
                <p className="small-copy">Date options will be added soon.</p>
              ) : (
                <div className="poll-list">
                  {dates.map((date) => {
                    const total = Math.max(1, date.available + date.maybe + date.unavailable)
                    return (
                      <div key={date.id} className={cn('poll-row', date.mine && 'is-selected')}>
                        <div className="poll-head">
                          <strong>
                            <LocalTime iso={date.startsAt.toISOString()} format="full" />
                          </strong>
                          <span className="tally">
                            {date.available} yes · {date.maybe} maybe · {date.unavailable} no
                          </span>
                        </div>
                        <div className="bar" aria-hidden="true">
                          <span style={{ width: `${(date.available / total) * 100}%` }} />
                        </div>
                        {viewer && (
                          <form action={voteDate} className="segmented">
                            <input type="hidden" name="nightId" value={night.id} />
                            <input type="hidden" name="optionId" value={date.id} />
                            {dateChoices.map((choice) => (
                              <button
                                key={choice.value}
                                type="submit"
                                name="response"
                                value={choice.value}
                                aria-pressed={date.mine === choice.value}
                                className={cn('seg', date.mine === choice.value && 'is-selected')}
                              >
                                {choice.label}
                              </button>
                            ))}
                          </form>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )}

          {night.gameVotingOpen && (
            <section className="panel" aria-labelledby="games-heading">
              <h2 id="games-heading">What are we playing?</h2>
              {games.length === 0 ? (
                <p className="small-copy">No games suggested yet. Be the first.</p>
              ) : (
                <div className="poll-list">
                  {games.map((game) => (
                    <div key={game.id} className={cn('poll-row', game.mine && 'is-selected')}>
                      <div className="poll-head">
                        <strong>{game.name}</strong>
                        <span className="tally">
                          {game.votes} {game.votes === 1 ? 'vote' : 'votes'}
                        </span>
                      </div>
                      <div className="bar" aria-hidden="true">
                        <span style={{ width: `${(game.votes / maxVotes) * 100}%` }} />
                      </div>
                      {viewer && (
                        <form action={voteGame}>
                          <input type="hidden" name="nightId" value={night.id} />
                          <input type="hidden" name="optionId" value={game.id} />
                          <button type="submit" aria-pressed={game.mine} className={cn('seg', game.mine && 'is-selected')}>
                            {game.mine ? 'Your vote' : 'Vote'}
                          </button>
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {viewer && (
                <form action={suggestGame} className="inline-form mt-4">
                  <input type="hidden" name="nightId" value={night.id} />
                  <label htmlFor="suggest-game" className="sr-only">
                    Suggest a game
                  </label>
                  <Input id="suggest-game" name="name" maxLength={60} placeholder="Suggest a game" required />
                  <Button type="submit" variant="outline">
                    Add
                  </Button>
                </form>
              )}
            </section>
          )}
        </div>

        <div className="stack">
          <section className="panel rainbow-card" aria-labelledby="rsvp-heading">
            <h2 id="rsvp-heading">RSVP</h2>
            <p className="small-copy">
              {rsvp.going} going{night.capacity ? ` of ${night.capacity}` : ''} · {rsvp.maybe} maybe
              {full && ' · Full'}
            </p>
            {viewer ? (
              <form action={setRsvp} className="segmented fill mt-3">
                <input type="hidden" name="nightId" value={night.id} />
                {rsvpChoices.map((choice) => (
                  <button
                    key={choice.value}
                    type="submit"
                    name="status"
                    value={choice.value}
                    aria-pressed={rsvp.mine === choice.value}
                    disabled={choice.value === 'going' && full && rsvp.mine !== 'going'}
                    className={cn('seg', rsvp.mine === choice.value && 'is-selected')}
                  >
                    {choice.label}
                  </button>
                ))}
              </form>
            ) : (
              <p className="small-copy mt-3">
                <Link href="/auth/sign-in" className="underline underline-offset-4">
                  Sign in
                </Link>{' '}
                to RSVP.
              </p>
            )}
          </section>

          <section className="panel" aria-labelledby="details-heading">
            <h2 id="details-heading">Details</h2>
            <dl className="facts">
              <dt>When</dt>
              <dd>{night.startsAt ? <LocalTime iso={night.startsAt.toISOString()} format="full" /> : 'To be decided'}</dd>
              <dt>Game</dt>
              <dd>{night.game || 'To be decided'}</dd>
              {night.capacity && (
                <>
                  <dt>Spots</dt>
                  <dd>{night.capacity}</dd>
                </>
              )}
              {night.discordUrl && (
                <>
                  <dt>Discord</dt>
                  <dd>
                    <a href={night.discordUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
                      Join the server <ExternalLink size={13} aria-hidden="true" />
                    </a>
                  </dd>
                </>
              )}
            </dl>
          </section>

          <section className="panel" aria-labelledby="going-heading">
            <h2 id="going-heading">Who is going</h2>
            {attendees.length ? (
              <div className="attendees">
                {attendees.map((name, index) => (
                  <span key={`${name}-${index}`} className="chip">
                    {name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="small-copy">Nobody yet.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
