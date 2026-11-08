import { auth } from '@/lib/auth/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
export const dynamic = 'force-dynamic'
async function signOut() { 'use server'; await auth.signOut(); redirect('/auth/sign-in') }
export default async function AccountPage() {
 const { data: session } = await auth.getSession()
 if (!session?.user) redirect('/auth/sign-in')
 return <div className="dashboard"><div className="page-heading"><div><div className="eyebrow">YOUR CORNER OF THE GANG</div><h1>Hey, {session.user.name}.</h1><p>Your account is connected securely with Neon Auth.</p></div></div><section className="rail-card account-details"><h2>Account details</h2><dl><dt>Display name</dt><dd>{session.user.name}</dd><dt>Email</dt><dd>{session.user.email}</dd><dt>Community access</dt><dd>Member</dd></dl><p>Administrative access is not automatically granted to new accounts. Owner assignment and event-management tools are still pending implementation.</p><form action={signOut}><Button variant="outline" type="submit">Sign out</Button></form></section></div>
}
