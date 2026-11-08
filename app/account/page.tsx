import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { Button } from '@/components/ui/button'
import { SteamLinkCard } from '@/components/steam-link-card'
import { auth } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { steamLinks } from '@/lib/db/schema'
import { requireViewer } from '@/lib/session'

export const dynamic = 'force-dynamic'

async function signOut() {
  'use server'
  await auth.signOut()
  redirect('/auth/sign-in')
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ steam?: string }> }) {
  const viewer = await requireViewer()
  const { steam } = await searchParams
  const [steamLink] = await db.select().from(steamLinks).where(eq(steamLinks.userId, viewer.id)).limit(1)
  const roleLabel = viewer.role === 'owner' ? 'Owner' : viewer.role === 'admin' ? 'Admin' : 'Member'

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <h1>Account</h1>
          <p>Signed in as {viewer.email}.</p>
        </div>
      </div>
      <section className="panel account-details" aria-labelledby="details-heading">
        <h2 id="details-heading">Account details</h2>
        <dl className="facts">
          <dt>Display name</dt>
          <dd>{viewer.name}</dd>
          <dt>Email</dt>
          <dd>{viewer.email}</dd>
          <dt>Role</dt>
          <dd>{roleLabel}</dd>
        </dl>
        <form action={signOut} className="mt-4">
          <Button variant="outline" type="submit">
            Sign out
          </Button>
        </form>
      </section>
      <SteamLinkCard link={steamLink ?? null} status={steam} />
    </div>
  )
}
