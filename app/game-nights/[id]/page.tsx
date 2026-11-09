import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Check, ExternalLink, Settings } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LocalTime } from '@/components/local-time'
import { Countdown } from '@/components/countdown'
import { GamePicker } from '@/components/game-picker'
import { NightChips } from '@/components/night-card'
import { respondToHostInvite, setRsvp, suggestGame, voteDate, voteGame } from '@/app/game-nights/actions'
import { getNightAccess } from '@/lib/access'
import { getNightDetail } from '@/lib/game-nights'
import { getLibrary } from '@/lib/library'
import { getViewer } from '@/lib/session'
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

const roleNames: Record<string, string> = { lead: 'Lead host', co: 'Co-host', coordinator: 'Coordinator', custom: 'Helper' }

function offsetLabel(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours ? `+${hours}h${mins ? ` ${mins}m` : ''}` : `+${mins}m`
}

export default async function GameNightPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const viewer = await getViewer()
  const detail = await getNightDetail(id, viewer?.id ?? null)
  if (!detail) notFound()
  const { night, dates, pollGames, games, hosts, activities, rsvp, attendees, lengthMinutes } = detail
  const access = await getNightAccess(viewer, night.id)
  const invite = hosts.find((host) => host.userId === viewer?.id && host.status === 'pending')
  if (night.status === 'draft' && !access.canRun && !invite) notFound()

  const now = Date.now()
  const rsvpClosed = Boolean(night.rsvpDeadline && night.rsvpDeadline.getTime() < now)
  const full = Boolean(night.capacity && rsvp.going >= night.capacity)
  const schedulingOpen = night.schedulingOpen && !(night.schedulingDeadline && night.schedulingDeadline.getTime() < now)
  const votingOpen = night.gameVotingOpen && !(night.gameVotingDeadline && night.gameVotingDeadline.getTime() < now)
  const maxVotes = Math.max(1, ...pollGames.map((game) => game.votes))
  const art = night.bannerUrl ?? games.find((game) => game.backgroundUrl)?.backgroundUrl ?? null
  const library = votingOpen && viewer ? await getLibrary(viewer.id) : []
  const summary = { ...night, going: rsvp.going, art, gameNames: games.map((game) => game.name), lengthMinutes }
  const acceptedHosts = hosts.filter((host) => host.status === 'accepted')
  const going = attendees.filter((item) => item.status === 'going')
  const maybe = attendees.filter((item) => item.status === 'maybe')
  const waitlist = attendees.filter((item) => item.status === 'waitlist')

  return (
    <div className="dashboard">
      <Link href="/" className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={15} aria-hidden="true" /> All game nights
      </Link>

      {invite && (
        <section className="callout" aria-label="Host invitation">
          <span>
            You have been invited to help host as <strong>{invite.role === 'custom' ? invite.customRole : roleNames[invite.role]}</strong>
            {invite.responsibilities ? `: ${invite.responsibilities}` : '.'}
          </span>
          <form action={respondToHostInvite} className="flex gap-2">
            <input type="hidden" name="nightId" value={night.id} />
            <Button type="submit" name="decision" value="accept" size="sm" className="btn-rainbow">
              Accept
            </Button>
            <Button type="submit" name="decision" value="decline" size="sm" variant="outline">
              Decline
            </Button>
          </form>
        </section>
      )}

      <div className="page-heading">
        <div className="flex flex-col gap-3">
          <NightChips night={summary} />
          <h1>{night.title}</h1>
          <p>
            {night.startsAt ? <LocalTime iso={night.startsAt.toISOString()} format="full" /> : 'Date to be decided'}
            {games.length > 0 && ` · ${games.map((game) => game.name).join(', ')}`}
            {night.startsAt && night.startsAt.getTime() > now && (
              <>
                {' · '}
                <Countdown iso={night.startsAt.toISOString()} prefix="Starts in" />
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {night.discordUrl && (
            <a href={night.discordUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'outline' })}>
              <ExternalLink aria-hidden="true" /> Join Discord
            </a>
          )}
          {access.canRun && (
            <Link href={`/admin/game-nights/${night.id}`} className={buttonVariants({ variant: 'outline' })}>
              <Settings aria-hidden="true" /> Manage
            </Link>
          )}
        </div>
      </div>

      {art && <img src={art} alt="" className="detail-banner" />}

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

          {games.length > 0 && (
            <section className="panel" aria-labelledby="games-heading">
              <h2 id="games-heading">{games.length === 1 ? 'The game' : 'The games'}</h2>
              <ul className="game-grid">
                {games.map((game) => (
                  <li key={game.id} className="game-tile">
                    {game.coverUrl ? <img src={game.coverUrl} alt="" /> : <div className="game-tile-blank" aria-hidden="true" />}
                    <div>
                      <strong>{game.name}</strong>
                      <small>{(game.genres as string[]).slice(0, 3).join(' · ')}</small>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {activities.length > 0 && (
            <section className="panel" aria-labelledby="agenda-heading">
              <h2 id="agenda-heading">Schedule</h2>
              <ol className="agenda">
                {activities.map((activity) => (
                  <li key={activity.id} className={cn('agenda-item', `agenda-${activity.type}`)}>
                    <div className="agenda-time">
                      {night.startsAt ? <LocalTime iso={new Date(night.startsAt.getTime() + activity.startOffset * 60000).toISOString()} format="short" /> : offsetLabel(activity.startOffset)}
                      <small>{activity.duration} min</small>
                    </div>
                    <div className="agenda-body">
                      <strong>{activity.title}</strong>
                      {activity.gameName && <span className="small-copy">{activity.gameName}</span>}
                      {activity.description && <p className="small-copy">{activity.description}</p>}
                      <div className="chips">
                        {activity.hosts.map((host) => (
                          <span key={host.id} className="chip">
                            Hosted by {host.name}
                          </span>
                        ))}
                        {activity.discordChannel && <span className="chip">Discord: {activity.discordChannel}</span>}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {dates.length > 0 && (
            <section className="panel" aria-labelledby="dates-heading">
              <h2 id="dates-heading">Which date works?</h2>
              <p className="small-copy">
                {schedulingOpen ? (
                  night.schedulingDeadline ? (
                    <>
                      Voting closes <LocalTime iso={night.schedulingDeadline.toISOString()} />.
                    </>
                  ) : (
                    'Vote on every date you could make.'
                  )
                ) : (
                  'Date voting is closed.'
                )}
              </p>
              <ul className="poll-list">
                {dates.map((date) => (
                  <li key={date.id} className={cn('poll-row', date.best && 'is-best')}>
                    <div>
                      <strong>
                        <LocalTime iso={date.startsAt.toISOString()} format="full" />
                      </strong>
                      <span className="small-copy">
                        {date.available} yes · {date.maybe} maybe · {date.unavailable} no{date.best ? ' · Most popular' : ''}
                      </span>
                    </div>
                    {viewer && schedulingOpen && (
                      <form action={voteDate} className="segmented" role="group" aria-label="Your availability">
                        <input type="hidden" name="nightId" value={night.id} />
                        <input type="hidden" name="optionId" value={date.id} />
                        {dateChoices.map((choice) => (
                          <Button
                            key={choice.value}
                            type="submit"
                            name="response"
                            value={choice.value}
                            size="sm"
                            variant={date.mine === choice.value ? 'default' : 'outline'}
                            aria-pressed={date.mine === choice.value}
                          >
                            {choice.label}
                          </Button>
                        ))}
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(pollGames.length > 0 || votingOpen) && (
            <section className="panel" aria-labelledby="vote-heading">
              <h2 id="vote-heading">What should we play?</h2>
              <p className="small-copy">
                {votingOpen
                  ? `${night.gameVoteMode === 'multi' ? 'Vote for as many games as you like.' : 'You get one vote.'}${night.gameVotingDeadline ? ' Closes ' : ''}`
                  : 'Game voting is closed.'}
                {votingOpen && night.gameVotingDeadline && <LocalTime iso={night.gameVotingDeadline.toISOString()} />}
              </p>
              <ul className="poll-list">
                {pollGames.map((game) => (
                  <li key={game.id} className="poll-row">
                    <div className="poll-game">
                      {game.coverUrl && <img src={game.coverUrl} alt="" width={72} height={46} />}
                      <div className="poll-bar-wrap">
                        <strong>{game.name}</strong>
                        <div className="poll-bar" aria-hidden="true">
                          <span style={{ width: `${(game.votes / maxVotes) * 100}%` }} />
                        </div>
                        <span className="small-copy">
                          {game.votes} {game.votes === 1 ? 'vote' : 'votes'}
                        </span>
                      </div>
                    </div>
                    {viewer && votingOpen && (
                      <form action={voteGame}>
                        <input type="hidden" name="nightId" value={night.id} />
                        <input type="hidden" name="optionId" value={game.id} />
                        <Button type="submit" size="sm" variant={game.mine ? 'default' : 'outline'} aria-pressed={game.mine}>
                          {game.mine && <Check aria-hidden="true" />}
                          {game.mine ? 'Voted' : 'Vote'}
                        </Button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
              {viewer && votingOpen && (
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-semibold">Suggest a game</h3>
                  <GamePicker id="suggest-game" action={suggestGame} hidden={{ nightId: night.id }} library={library} placeholder="Search for a game to suggest" />
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="stack">
          <section className="panel rainbow-card" aria-labelledby="rsvp-heading">
            <h2 id="rsvp-heading">RSVP</h2>
            <p className="small-copy">
              {rsvp.going} going{night.capacity ? ` of ${night.capacity} spots` : ''}
              {rsvp.maybe > 0 && ` · ${rsvp.maybe} maybe`}
              {rsvp.waitlist > 0 && ` · ${rsvp.waitlist} waitlisted`}
            </p>
            {night.rsvpDeadline && !rsvpClosed && (
              <p className="small-copy">
                RSVPs close <LocalTime iso={night.rsvpDeadline.toISOString()} />
              </p>
            )}
            {rsvp.mine === 'waitlist' && <p className="notice">You are #{rsvp.myWaitlistPosition} on the waitlist. We will tell you if a spot opens.</p>}
            {viewer ? (
              rsvpClosed && !rsvp.mine ? (
                <p className="small-copy">RSVPs are closed.</p>
              ) : (
                <form action={setRsvp} className="stack-sm">
                  <input type="hidden" name="nightId" value={night.id} />
                  {night.rsvpQuestion && (
                    <div className="form-field">
                      <label htmlFor="answer">{night.rsvpQuestion}</label>
                      <Input id="answer" name="answer" maxLength={200} defaultValue={rsvp.mineAnswer ?? ''} />
                    </div>
                  )}
                  <div className="segmented" role="group" aria-label="Your RSVP">
                    {rsvpChoices.map((choice) => {
                      const joinsWaitlist = choice.value === 'going' && full && rsvp.mine !== 'going' && night.waitlistEnabled
                      const blocked = choice.value === 'going' && full && rsvp.mine !== 'going' && !night.waitlistEnabled
                      const selected = rsvp.mine === choice.value || (joinsWaitlist === false && rsvp.mine === 'waitlist' && choice.value === 'going')
                      return (
                        <Button
                          key={choice.value}
                          type="submit"
                          name="status"
                          value={choice.value}
                          variant={selected ? 'default' : 'outline'}
                          aria-pressed={selected}
                          disabled={blocked || (rsvpClosed && choice.value !== 'not_going')}
                        >
                          {joinsWaitlist ? 'Join waitlist' : blocked ? 'Full' : choice.label}
                        </Button>
                      )
                    })}
                  </div>
                </form>
              )
            ) : (
              <Link href="/auth/sign-in" className={buttonVariants()}>
                Sign in to RSVP
              </Link>
            )}
          </section>

          {acceptedHosts.length > 0 && (
            <section className="panel" aria-labelledby="hosts-heading">
              <h2 id="hosts-heading">Hosts</h2>
              <ul className="people-list">
                {acceptedHosts.map((host) => (
                  <li key={host.id}>
                    <span>{host.user?.name ?? 'Member'}</span>
                    <span className="chip">{host.role === 'custom' ? host.customRole : roleNames[host.role]}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="panel" aria-labelledby="who-heading">
            <h2 id="who-heading">Who&apos;s coming</h2>
            {attendees.length === 0 ? (
              <p className="small-copy">No RSVPs yet. Be the first.</p>
            ) : (
              <ul className="people-list">
                {going.map((item, index) => (
                  <li key={`g-${index}`}>
                    <span>{item.user?.name ?? 'Member'}</span>
                    {item.checkedIn && <span className="chip chip-live">Here</span>}
                  </li>
                ))}
                {maybe.map((item, index) => (
                  <li key={`m-${index}`}>
                    <span>{item.user?.name ?? 'Member'}</span>
                    <span className="chip">Maybe</span>
                  </li>
                ))}
                {waitlist.map((item, index) => (
                  <li key={`w-${index}`}>
                    <span>{item.user?.name ?? 'Member'}</span>
                    <span className="chip">Waitlist</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
