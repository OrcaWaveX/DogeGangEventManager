import { auth } from '@/lib/auth/server'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { Button } from '@/components/ui/button'
import { SteamLinkCard } from '@/components/steam-link-card'
import { db } from '@/lib/db'
import { steamLinks } from '@/lib/db/schema'
export const dynamic = 'force-dynamic'
async function signOut() { 'use server'; await auth.signOut(); redirect('/auth/sign-in') }
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ steam?: string }> }) {
 const { data: session } = await auth.getSession()
 if (!session?.user) redirect('/auth/sign-in')
 const { steam } = await searchParams
 const [steamLink] = await db.select().from(steamLinks).where(eq(steamLinks.userId, session.user.id)).limit(1)
 return <div className="dashboard"><div className="page-heading"><div><h1>Account</h1><p>Signed in as {session.user.email}.</p></div></div><section className="rail-card account-details"><h2>Account details</h2><dl><dt>Display name</dt><dd>{session.user.name}</dd><dt>Email</dt><dd>{session.user.email}</dd><dt>Community access</dt><dd>Member</dd></dl><p>Administrative access is not automatically granted to new accounts. Owner assignment and event-management tools are still pending implementation.</p><form action={signOut}><Button variant="outline" type="submit">Sign out</Button></form></section><SteamLinkCard link={steamLink ?? null} status={steam}/></div>
}
