import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink, Trash2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateTimeField } from '@/components/datetime-field'
import { LocalTime } from '@/components/local-time'
import { NightChips } from '@/components/night-card'
import { ConfirmSubmit } from '@/components/confirm-submit'
import {
  addDateOption,
  addGameOption,
  deleteGameNight,
  lockInDate,
  lockInGame,
  removeDateOption,
  removeGameOption,
  setNightStatus,
  updateGameNight,
} from '@/app/admin/actions'
import { getNightDetail } from '@/lib/game-nights'
import { requireAdmin } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function AdminNightPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  const viewer = await requireAdmin()
  const { id } = await params
  const { saved, error } = await searchParams
  const detail = await getNightDetail(id, viewer.id)
  if (!detail) notFound()
  const { night, dates, games, rsvp, attendees } = detail

  return (
    <div className="dashboard">
      <Link href="/admin" className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={15} aria-hidden="true" /> All game nights
      </Link>
      <div className="page-heading">
        <div className="flex flex-col gap-3">
          <NightChips night={{ ...night, going: rsvp.going }} />
          <h1>{night.title}</h1>
          <p>
            {rsvp.going} going · {rsvp.maybe} maybe · {rsvp.notGoing} can&apos;t go
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {night.status !== 'draft' && (
            <form action={setNightStatus}>
              <input type="hidden" name="id" value={night.id} />
              <input type="hidden" name="status" value="draft" />
              <Button type="submit" variant="outline">Unpublish</Button>
            </form>
          )}
          {night.status !== 'published' && (
            <form action={setNightStatus}>
              <input type="hidden" name="id" value={night.id} />
              <input type="hidden" name="status" value="published" />
              <Button type="submit" className="btn-rainbow">Publish</Button>
            </form>
          )}
          {night.status !== 'archived' && (
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
              <label htmlFor="game">Game</label>
              <Input id="game" name="game" defaultValue={night.game ?? ''} maxLength={60} />
            </div>
            <div className="form-field">
              <label htmlFor="capacity">Spots</label>
              <Input id="capacity" name="capacity" type="number" min={1} max={1000} defaultValue={night.capacity ?? ''} />
            </div>
            <div className="form-field">
              <label htmlFor="discordUrl">Discord invite link</label>
              <Input id="discordUrl" name="discordUrl" type="url" defaultValue={night.discordUrl ?? ''} />
            </div>
            <div className="form-field wide">
              <label htmlFor="bannerUrl">Banner image URL</label>
              <Input id="bannerUrl" name="bannerUrl" type="url" defaultValue={night.bannerUrl ?? ''} />
            </div>
            <div className="form-field wide">
              <label htmlFor="description">Description</label>
              <textarea id="description" name="description" rows={4} maxLength={2000} defaultValue={night.description ?? ''} className="field-textarea" />
            </div>
            <label className="check wide">
              <input type="checkbox" name="schedulingOpen" defaultChecked={night.schedulingOpen} /> Date poll is open
            </label>
            <label className="check wide">
              <input type="checkbox" name="gameVotingOpen" defaultChecked={night.gameVotingOpen} /> Game vote is open
            </label>
            <div className="wide">
              <Button type="submit">Save changes</Button>
            </div>
          </form>
        </section>

        <div className="stack">
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
                      {date.available} yes · {date.maybe} maybe · {date.unavailable} no
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

          <section className="panel" aria-labelledby="games-heading">
            <h2 id="games-heading">Game options</h2>
            <ul className="admin-list">
              {games.map((game) => (
                <li key={game.id} className="admin-row">
                  <div>
                    <strong>{game.name}</strong>
                    <span className="small-copy">{game.votes} {game.votes === 1 ? 'vote' : 'votes'}</span>
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
              {games.length === 0 && <li className="small-copy">No options yet.</li>}
            </ul>
            <form action={addGameOption} className="inline-form mt-4">
              <input type="hidden" name="nightId" value={night.id} />
              <label htmlFor="game-name" className="sr-only">Add a game option</label>
              <Input id="game-name" name="name" maxLength={60} placeholder="Add a game option" required />
              <Button type="submit" variant="outline">Add</Button>
            </form>
          </section>

          <section className="panel" aria-labelledby="who-heading">
            <h2 id="who-heading">Going ({attendees.length})</h2>
            {attendees.length ? (
              <div className="attendees">
                {attendees.map((name, index) => (
                  <span key={`${name}-${index}`} className="chip">{name}</span>
                ))}
              </div>
            ) : (
              <p className="small-copy">Nobody yet.</p>
            )}
          </section>

          <section className="panel" aria-labelledby="danger-heading">
            <h2 id="danger-heading">Danger zone</h2>
            <form action={deleteGameNight}>
              <input type="hidden" name="id" value={night.id} />
              <ConfirmSubmit message="Delete this game night and all of its RSVPs and votes? This cannot be undone.">
                Delete game night
              </ConfirmSubmit>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}
