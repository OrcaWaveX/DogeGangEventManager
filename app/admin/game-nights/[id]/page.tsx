import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Check, Copy, ExternalLink, Trash2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateTimeField } from '@/components/datetime-field'
import { GamePicker } from '@/components/game-picker'
import { LocalTime } from '@/components/local-time'
import { NightChips } from '@/components/night-card'
import { ConfirmSubmit } from '@/components/confirm-submit'
import {
  addDateOption,
  addGameOption,
  addNightGame,
  deleteGameNight,
  duplicateNight,
  inviteHost,
  lockInDate,
  lockInGame,
  removeActivity,
  removeAttendee,
  removeDateOption,
  removeGameOption,
  removeHost,
  removeNightGame,
  saveActivity,
  setNightStatus,
  toggleCheckIn,
  updateGameNight,
} from '@/app/admin/actions'
import { getNightAccess } from '@/lib/access'
import { getNightDetail, type NightDetail } from '@/lib/game-nights'
import { getLibrary } from '@/lib/library'
import { getViewer } from '@/lib/session'
import { listMembers } from '@/lib/users'

export const dynamic = 'force-dynamic'

const hostRoles = [
  { value: 'lead', label: 'Lead host' },
  { value: 'co', label: 'Co-host' },
  { value: 'coordinator', label: 'Coordinator' },
  { value: 'custom', label: 'Custom role' },
]

const activityTypes = [
  { value: 'game', label: 'Game' },
  { value: 'intro', label: 'Intro' },
  { value: 'tournament', label: 'Tournament' },
  { value: 'break', label: 'Break' },
  { value: 'custom', label: 'Other' },
]

type Activity = NightDetail['activities'][number]

function ActivityFields({ nightId, activity, members }: { nightId: string; activity?: Activity; members: { id: string; name: string }[] }) {
  const key = activity?.id ?? 'new'
  return (
    <form action={saveActivity} className="form-grid">
      <input type="hidden" name="nightId" value={nightId} />
      {activity && <input type="hidden" name="activityId" value={activity.id} />}
      <div className="form-field wide">
        <label htmlFor={`title-${key}`}>Title</label>
        <Input id={`title-${key}`} name="title" defaultValue={activity?.title} maxLength={100} placeholder="Round one" required />
      </div>
      <div className="form-field">
        <label htmlFor={`type-${key}`}>Type</label>
        <select id={`type-${key}`} name="type" defaultValue={activity?.type ?? 'game'} className="field-select">
          {activityTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor={`game-${key}`}>Game (optional)</label>
        <Input id={`game-${key}`} name="gameName" defaultValue={activity?.gameName ?? ''} maxLength={80} />
      </div>
      <div className="form-field">
        <label htmlFor={`start-${key}`}>Starts after (minutes)</label>
        <Input id={`start-${key}`} name="startOffset" type="number" min={0} max={1440} defaultValue={activity?.startOffset ?? 0} />
      </div>
      <div className="form-field">
        <label htmlFor={`dur-${key}`}>Length (minutes)</label>
        <Input id={`dur-${key}`} name="duration" type="number" min={5} max={720} defaultValue={activity?.duration ?? 30} />
      </div>
      <div className="form-field">
        <label htmlFor={`channel-${key}`}>Discord channel (optional)</label>
        <Input id={`channel-${key}`} name="discordChannel" defaultValue={activity?.discordChannel ?? ''} maxLength={60} placeholder="#game-night-1" />
      </div>
      <div className="form-field wide">
        <label htmlFor={`desc-${key}`}>Notes</label>
        <textarea id={`desc-${key}`} name="description" rows={2} maxLength={600} defaultValue={activity?.description ?? ''} className="field-textarea" />
      </div>
      <fieldset className="wide">
        <legend className="small-copy">Who runs this?</legend>
        <div className="check-grid">
          {members.map((member) => (
            <label key={member.id} className="check">
              <input type="checkbox" name="hostIds" value={member.id} defaultChecked={activity?.hostIds.includes(member.id)} /> {member.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="wide">
        <Button type="submit" variant={activity ? 'outline' : 'default'}>
          {activity ? 'Save activity' : 'Add to schedule'}
        </Button>
      </div>
    </form>
  )
}

export default async function AdminNightPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  const viewer = await getViewer()
  if (!viewer) redirect('/auth/sign-in')
  const { id } = await params
  const { saved, error } = await searchParams
  const detail = await getNightDetail(id, viewer.id)
  if (!detail) notFound()
  const access = await getNightAccess(viewer, detail.night.id)
  if (!access.canRun) redirect('/')
  const { night, dates, pollGames, games, hosts, activities, rsvp, attendees, lengthMinutes } = detail
  const [members, library] = await Promise.all([listMembers(), getLibrary(viewer.id)])
  const nameOf = new Map(members.map((member) => [member.id, member.name]))
  const memberList = members.map((member) => ({ id: member.id, name: member.name }))
  const summary = { ...night, going: rsvp.going, art: null, gameNames: games.map((game) => game.name), lengthMinutes }

  return (
    <div className="dashboard">
      <Link href={access.admin ? '/admin' : `/game-nights/${night.id}`} className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={15} aria-hidden="true" /> {access.admin ? 'All game nights' : 'Back to game night'}
      </Link>
      <div className="page-heading">
        <div className="flex flex-col gap-3">
          <NightChips night={summary} />
          <h1>{night.title}</h1>
          <p>
            {rsvp.going} going · {rsvp.maybe} maybe · {rsvp.waitlist} waitlisted · {rsvp.checkedIn} checked in
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {access.admin && night.status !== 'draft' && (
            <form action={setNightStatus}>
              <input type="hidden" name="id" value={night.id} />
              <input type="hidden" name="status" value="draft" />
              <Button type="submit" variant="outline">Unpublish</Button>
            </form>
          )}
          {access.admin && night.status !== 'published' && (
            <form action={setNightStatus}>
              <input type="hidden" name="id" value={night.id} />
              <input type="hidden" name="status" value="published" />
              <Button type="submit" className="btn-rainbow">Publish</Button>
            </form>
          )}
          {access.admin && night.status === 'published' && (
            <form action={setNightStatus}>
              <input type="hidden" name="id" value={night.id} />
              <input type="hidden" name="status" value="cancelled" />
              <ConfirmSubmit message="Cancel this game night? Everyone who RSVPed will be notified.">Cancel night</ConfirmSubmit>
            </form>
          )}
          {access.admin && night.status !== 'archived' && (
            <form action={setNightStatus}>
              <input type="hidden" name="id" value={night.id} />
              <input type="hidden" name="status" value="archived" />
              <Button type="submit" variant="outline">Archive</Button>
            </form>
          )}
          <Link href={`/game-nights/${night.id}`} className={buttonVariants({ variant: 'outline' })}>
            View page <ExternalLink aria-hidden="true" />
          </Link>
        </div>
      </div>
      {saved && <p className="notice" role="status">Changes saved.</p>}

      <div className="detail-grid">
        <div className="stack">
          <section className="panel" aria-labelledby="edit-heading">
            <h2 id="edit-heading">Details</h2>
            <form action={updateGameNight} className="form-grid">
              <input type="hidden" name="id" value={night.id} />
              <div className="form-field wide">
                <label htmlFor="title">Title</label>
                <Input id="title" name="title" defaultValue={night.title} maxLength={100} required />
                {error === 'title' && <span className="form-error">A title is required.</span>}
              </div>
              <DateTimeField name="startsAt" label="Date and time" defaultValue={night.startsAt?.toISOString() ?? null} />
              <div className="form-field">
                <label htmlFor="capacity">Spots</label>
                <Input id="capacity" name="capacity" type="number" min={1} max={1000} defaultValue={night.capacity ?? ''} />
              </div>
              <div className="form-field">
                <label htmlFor="discordUrl">Discord invite link</label>
                <Input id="discordUrl" name="discordUrl" type="url" defaultValue={night.discordUrl ?? ''} />
              </div>
              <div className="form-field">
                <label htmlFor="bannerUrl">Banner image URL</label>
                <Input id="bannerUrl" name="bannerUrl" type="url" defaultValue={night.bannerUrl ?? ''} />
              </div>
              <div className="form-field wide">
                <label htmlFor="description">Description</label>
                <textarea id="description" name="description" rows={4} maxLength={2000} defaultValue={night.description ?? ''} className="field-textarea" />
              </div>

              <h3 className="wide form-subheading">RSVPs</h3>
              <DateTimeField name="rsvpDeadline" label="RSVP deadline (optional)" defaultValue={night.rsvpDeadline?.toISOString() ?? null} />
              <div className="form-field">
                <label htmlFor="rsvpQuestion">Question for attendees (optional)</label>
                <Input id="rsvpQuestion" name="rsvpQuestion" maxLength={140} defaultValue={night.rsvpQuestion ?? ''} placeholder="Any dietary needs?" />
              </div>
              <label className="check wide">
                <input type="checkbox" name="waitlistEnabled" defaultChecked={night.waitlistEnabled} /> Offer a waitlist when spots are full
              </label>

              <h3 className="wide form-subheading">Polls</h3>
              <label className="check wide">
                <input type="checkbox" name="schedulingOpen" defaultChecked={night.schedulingOpen} /> Date poll is open
              </label>
              <DateTimeField name="schedulingDeadline" label="Date poll closes (optional)" defaultValue={night.schedulingDeadline?.toISOString() ?? null} />
              <label className="check wide">
                <input type="checkbox" name="gameVotingOpen" defaultChecked={night.gameVotingOpen} /> Game vote is open
              </label>
              <DateTimeField name="gameVotingDeadline" label="Game vote closes (optional)" defaultValue={night.gameVotingDeadline?.toISOString() ?? null} />
              <div className="form-field">
                <label htmlFor="gameVoteMode">Votes per person</label>
                <select id="gameVoteMode" name="gameVoteMode" defaultValue={night.gameVoteMode} className="field-select">
                  <option value="single">One vote</option>
                  <option value="multi">Any number of votes</option>
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="recurrence">Repeats</label>
                <select id="recurrence" name="recurrence" defaultValue={night.recurrence} className="field-select">
                  <option value="none">Does not repeat</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Every two weeks</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="wide">
                <Button type="submit">Save changes</Button>
              </div>
            </form>
          </section>

          <section className="panel" aria-labelledby="schedule-heading">
            <h2 id="schedule-heading">Schedule</h2>
            <p className="small-copy">Plan the evening: intro, rounds, breaks and who runs each part.</p>
            {activities.length > 0 && (
              <ul className="admin-list">
                {activities.map((activity) => (
                  <li key={activity.id}>
                    <details className="activity-edit">
                      <summary>
                        <span>
                          <strong>{activity.title}</strong>
                          <span className="small-copy">
                            {' '}
                            +{activity.startOffset}m · {activity.duration} min{activity.hosts.length ? ` · ${activity.hosts.map((host) => host.name).join(', ')}` : ''}
                          </span>
                        </span>
                      </summary>
                      <ActivityFields nightId={night.id} activity={activity} members={memberList} />
                      <form action={removeActivity} className="mt-2">
                        <input type="hidden" name="nightId" value={night.id} />
                        <input type="hidden" name="activityId" value={activity.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          <Trash2 aria-hidden="true" /> Remove activity
                        </Button>
                      </form>
                    </details>
                  </li>
                ))}
              </ul>
            )}
            <details className="activity-edit" open={activities.length === 0}>
              <summary>
                <strong>Add an activity</strong>
              </summary>
              <ActivityFields nightId={night.id} members={memberList} />
            </details>
          </section>
        </div>

        <div className="stack">
          <section className="panel" aria-labelledby="games-heading">
            <h2 id="games-heading">Games</h2>
            <p className="small-copy">Search the game database. Covers and genres are added for you.</p>
            <ul className="admin-list">
              {games.map((game) => (
                <li key={game.id} className="admin-row">
                  <div className="poll-game">
                    {game.coverUrl && <img src={game.coverUrl} alt="" width={64} height={40} />}
                    <strong>{game.name}</strong>
                  </div>
                  <form action={removeNightGame}>
                    <input type="hidden" name="nightId" value={night.id} />
                    <input type="hidden" name="gameId" value={game.id} />
                    <Button type="submit" variant="ghost" size="sm" aria-label={`Remove ${game.name}`}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </form>
                </li>
              ))}
              {games.length === 0 && <li className="small-copy">No games chosen yet.</li>}
            </ul>
            <div className="mt-4">
              <GamePicker id="add-game" action={addNightGame} hidden={{ nightId: night.id }} library={library} placeholder="Search to add a game" />
            </div>
          </section>

          <section className="panel" aria-labelledby="dates-heading">
            <h2 id="dates-heading">Date options</h2>
            <ul className="admin-list">
              {dates.map((date) => (
                <li key={date.id} className="admin-row">
                  <div>
                    <strong>
                      <LocalTime iso={date.startsAt.toISOString()} format="full" />
                    </strong>
                    <span className="small-copy">
                      {date.available} yes · {date.maybe} maybe · {date.unavailable} no{date.best ? ' · Most popular' : ''}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <form action={lockInDate}>
                      <input type="hidden" name="nightId" value={night.id} />
                      <input type="hidden" name="optionId" value={date.id} />
                      <Button type="submit" variant="outline" size="sm">Lock in</Button>
                    </form>
                    <form action={removeDateOption}>
                      <input type="hidden" name="nightId" value={night.id} />
                      <input type="hidden" name="optionId" value={date.id} />
                      <Button type="submit" variant="ghost" size="sm" aria-label="Remove date option">
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
              {dates.length === 0 && <li className="small-copy">No options yet.</li>}
            </ul>
            <form action={addDateOption} className="inline-form mt-4">
              <input type="hidden" name="nightId" value={night.id} />
              <DateTimeField name="startsAt" label="Add a date option" required />
              <Button type="submit" variant="outline">Add</Button>
            </form>
          </section>

          <section className="panel" aria-labelledby="vote-heading">
            <h2 id="vote-heading">Game vote options</h2>
            <ul className="admin-list">
              {pollGames.map((game) => (
                <li key={game.id} className="admin-row">
                  <div className="poll-game">
                    {game.coverUrl && <img src={game.coverUrl} alt="" width={64} height={40} />}
                    <div>
                      <strong>{game.name}</strong>
                      <span className="small-copy">
                        {game.votes} {game.votes === 1 ? 'vote' : 'votes'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <form action={lockInGame}>
                      <input type="hidden" name="nightId" value={night.id} />
                      <input type="hidden" name="optionId" value={game.id} />
                      <Button type="submit" variant="outline" size="sm">Lock in</Button>
                    </form>
                    <form action={removeGameOption}>
                      <input type="hidden" name="nightId" value={night.id} />
                      <input type="hidden" name="optionId" value={game.id} />
                      <Button type="submit" variant="ghost" size="sm" aria-label={`Remove ${game.name}`}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
              {pollGames.length === 0 && <li className="small-copy">No options yet.</li>}
            </ul>
            <div className="mt-4">
              <GamePicker id="add-option" action={addGameOption} hidden={{ nightId: night.id }} library={library} placeholder="Search to add a vote option" />
            </div>
          </section>

          <section className="panel" aria-labelledby="hosts-heading">
            <h2 id="hosts-heading">Hosts</h2>
            <ul className="admin-list">
              {hosts.map((host) => (
                <li key={host.id} className="admin-row">
                  <div>
                    <strong>{host.user?.name ?? nameOf.get(host.userId) ?? 'Member'}</strong>
                    <span className="small-copy">
                      {host.role === 'custom' ? host.customRole : hostRoles.find((role) => role.value === host.role)?.label} · {host.status}
                      {host.responsibilities ? ` · ${host.responsibilities}` : ''}
                    </span>
                  </div>
                  <form action={removeHost}>
                    <input type="hidden" name="nightId" value={night.id} />
                    <input type="hidden" name="userId" value={host.userId} />
                    <Button type="submit" variant="ghost" size="sm" aria-label="Remove host">
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </form>
                </li>
              ))}
              {hosts.length === 0 && <li className="small-copy">No hosts invited yet.</li>}
            </ul>
            <form action={inviteHost} className="form-grid mt-4">
              <input type="hidden" name="nightId" value={night.id} />
              <div className="form-field">
                <label htmlFor="host-user">Member</label>
                <select id="host-user" name="userId" className="field-select" required defaultValue="">
                  <option value="" disabled>
                    Choose a member
                  </option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="host-role">Role</label>
                <select id="host-role" name="role" className="field-select" defaultValue="co">
                  {hostRoles.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="host-custom">Custom role name</label>
                <Input id="host-custom" name="customRole" maxLength={40} placeholder="Only for custom role" />
              </div>
              <div className="form-field">
                <label htmlFor="host-resp">Responsibilities</label>
                <Input id="host-resp" name="responsibilities" maxLength={400} placeholder="Run the tournament bracket" />
              </div>
              <div className="wide">
                <Button type="submit" variant="outline">Send invite</Button>
              </div>
            </form>
          </section>

          <section className="panel" aria-labelledby="who-heading">
            <h2 id="who-heading">Attendees ({attendees.length})</h2>
            {attendees.length ? (
              <ul className="admin-list">
                {attendees.map((item, index) => {
                  const userId = [...nameOf.entries()].find(([, name]) => name === item.user?.name)?.[0]
                  return (
                    <li key={`${item.user?.id ?? index}`} className="admin-row">
                      <div>
                        <strong>{item.user?.name ?? 'Member'}</strong>
                        <span className="small-copy">
                          {item.status.replace('_', ' ')}
                          {item.answer ? ` · ${item.answer}` : ''}
                        </span>
                      </div>
                      {item.user && (
                        <div className="flex gap-2">
                          <form action={toggleCheckIn}>
                            <input type="hidden" name="nightId" value={night.id} />
                            <input type="hidden" name="userId" value={item.user.id} />
                            <Button type="submit" size="sm" variant={item.checkedIn ? 'default' : 'outline'} aria-pressed={item.checkedIn}>
                              <Check aria-hidden="true" /> {item.checkedIn ? 'Checked in' : 'Check in'}
                            </Button>
                          </form>
                          <form action={removeAttendee}>
                            <input type="hidden" name="nightId" value={night.id} />
                            <input type="hidden" name="userId" value={item.user.id} />
                            <Button type="submit" variant="ghost" size="sm" aria-label={`Remove ${item.user.name}`} data-user={userId}>
                              <Trash2 aria-hidden="true" />
                            </Button>
                          </form>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="small-copy">Nobody yet.</p>
            )}
          </section>

          {access.admin && (
            <section className="panel" aria-labelledby="danger-heading">
              <h2 id="danger-heading">More</h2>
              <div className="flex flex-wrap gap-2">
                {(['copy', 'template', 'next'] as const).map((mode) => (
                  <form action={duplicateNight} key={mode}>
                    <input type="hidden" name="nightId" value={night.id} />
                    <input type="hidden" name="mode" value={mode} />
                    <Button type="submit" variant="outline" size="sm">
                      <Copy aria-hidden="true" /> {mode === 'copy' ? 'Duplicate' : mode === 'template' ? 'Save as template' : 'Plan next one'}
                    </Button>
                  </form>
                ))}
              </div>
              <form action={deleteGameNight} className="mt-4">
                <input type="hidden" name="id" value={night.id} />
                <ConfirmSubmit message="Delete this game night and all of its RSVPs and votes? This cannot be undone.">Delete game night</ConfirmSubmit>
              </form>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
