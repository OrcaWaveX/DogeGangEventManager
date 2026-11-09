import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateTimeField } from '@/components/datetime-field'
import { LocalTime } from '@/components/local-time'
import { NightChips } from '@/components/night-card'
import { ConfirmSubmit } from '@/components/confirm-submit'
import { createFromTemplate, createGameNight, grantAdmin, revokeAdmin } from '@/app/admin/actions'
import { listAllNights, listTeam, listTemplates } from '@/lib/game-nights'
import { requireAdmin } from '@/lib/session'

export const dynamic = 'force-dynamic'

const teamMessages: Record<string, string> = {
  added: 'Admin added.',
  removed: 'Admin removed.',
  notfound: 'No account with that email. They need to sign up first.',
  missing: 'Enter an email address.',
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ team?: string; error?: string; deleted?: string }> }) {
  const viewer = await requireAdmin()
  const { team, error, deleted } = await searchParams
  const [nights, members, templates] = await Promise.all([listAllNights(), listTeam(), listTemplates()])

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Admin</span>
          <h1>Manage game nights</h1>
          <p>Create game nights, set dates, run the polls and lock in the plan. Drafts are only visible to admins.</p>
        </div>
      </div>
      {deleted && <p className="notice" role="status">Game night deleted.</p>}

      <section className="panel rainbow-card" aria-labelledby="create-heading">
        <h2 id="create-heading">New game night</h2>
        <form action={createGameNight} className="form-grid">
          <div className="form-field wide">
            <label htmlFor="title">Title</label>
            <Input id="title" name="title" maxLength={100} placeholder="Friday Co-op Night" required />
            {error === 'title' && <span className="form-error">A title is required.</span>}
          </div>
          <DateTimeField name="startsAt" label="Date and time (optional)" hint="Leave blank to run a date poll instead." />
          <div className="form-field">
            <label htmlFor="capacity">Spots (optional)</label>
            <Input id="capacity" name="capacity" type="number" min={1} max={1000} inputMode="numeric" />
          </div>
          <div className="form-field">
            <label htmlFor="discordUrl">Discord invite link (optional)</label>
            <Input id="discordUrl" name="discordUrl" type="url" placeholder="https://discord.gg/..." />
          </div>
          <div className="form-field wide">
            <label htmlFor="bannerUrl">Banner image URL (optional)</label>
            <Input id="bannerUrl" name="bannerUrl" type="url" placeholder="https://..." />
          </div>
          <div className="form-field wide">
            <label htmlFor="description">Description (optional)</label>
            <textarea id="description" name="description" rows={3} maxLength={2000} className="field-textarea" />
          </div>
          <div className="wide">
            <Button type="submit" className="btn-rainbow">
              <Plus aria-hidden="true" /> Create draft
            </Button>
          </div>
        </form>
      </section>

      {templates.length > 0 && (
        <section className="panel" aria-labelledby="templates-heading">
          <h2 id="templates-heading">Templates</h2>
          <ul className="admin-list">
            {templates.map((template) => (
              <li key={template.id} className="admin-row">
                <div>
                  <strong>{template.title}</strong>
                  <Link href={`/admin/game-nights/${template.id}`} className="small-copy underline">
                    Edit template
                  </Link>
                </div>
                <form action={createFromTemplate} className="inline-form">
                  <input type="hidden" name="templateId" value={template.id} />
                  <DateTimeField name="startsAt" label="Date for new night" />
                  <Button type="submit" variant="outline">Create from template</Button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="all-heading">
        <div className="section-heading">
          <h2 id="all-heading">All game nights</h2>
        </div>
        {nights.length === 0 ? (
          <div className="empty-state">
            <p>Nothing here yet. Create your first game night above.</p>
          </div>
        ) : (
          <ul className="admin-list">
            {nights.map((night) => (
              <li key={night.id}>
                <Link href={`/admin/game-nights/${night.id}`} className="admin-row">
                  <div>
                    <strong>{night.title}</strong>
                    <span className="small-copy">
                      {night.startsAt ? <LocalTime iso={night.startsAt.toISOString()} /> : 'No date yet'} · {night.going} going
                    </span>
                  </div>
                  <NightChips night={night} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel" aria-labelledby="team-heading">
        <h2 id="team-heading">Admin team</h2>
        <ul className="admin-list">
          {members.map((member) => (
            <li key={member.user_id} className="admin-row">
              <div>
                <strong>{member.name ?? 'Unknown user'}</strong>
                <span className="small-copy">{member.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="chip">{member.role === 'owner' ? 'Owner' : 'Admin'}</span>
                {viewer.role === 'owner' && member.role !== 'owner' && (
                  <form action={revokeAdmin}>
                    <input type="hidden" name="userId" value={member.user_id} />
                    <ConfirmSubmit message={`Remove admin access for ${member.name ?? 'this user'}?`}>Remove</ConfirmSubmit>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
        {viewer.role === 'owner' ? (
          <form action={grantAdmin} className="inline-form mt-4">
            <label htmlFor="admin-email" className="sr-only">
              Email of account to make admin
            </label>
            <Input id="admin-email" name="email" type="email" placeholder="Email of an existing account" required />
            <Button type="submit" variant="outline">
              Make admin
            </Button>
          </form>
        ) : (
          <p className="small-copy mt-3">Only the owner can add or remove admins.</p>
        )}
        {team && <p className="notice mt-3" role="status">{teamMessages[team]}</p>}
      </section>
    </div>
  )
}
