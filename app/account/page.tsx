import { auth } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { discordLinks } from '@/lib/db/schema'
import { discordAvatarUrl } from '@/lib/discord'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { DiscordLinkCard } from '@/components/discord-link-card'
export const dynamic = 'force-dynamic'
async function signOut() { 'use server'; await auth.signOut(); redirect('/auth/sign-in') }
async function unlinkDiscord() {
  'use server'
  const { data: session } = await auth.getSession()
  if (!session?.user) redirect('/auth/sign-in')
  await db.delete(discordLinks).where(eq(discordLinks.userId, session.user.id))
  revalidatePath('/account')
}
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ discord?: string }> }) {
 const { data: session } = await auth.getSession()
 if (!session?.user) redirect('/auth/sign-in')
 const { discord } = await searchParams
 const [row] = await db.select().from(discordLinks).where(eq(discordLinks.userId, session.user.id)).limit(1)
 const link = row ? { discordId: row.discordId, username: row.username, globalName: row.globalName, avatarUrl: discordAvatarUrl(row.discordId, row.avatar) } : null
 const configured = Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET)
 return <div className="dashboard"><div className="page-heading"><div><h1>Account</h1><p>Signed in as {session.user.email}.</p></div></div><section className="rail-card account-details"><h2>Account details</h2><dl><dt>Display name</dt><dd>{session.user.name}</dd><dt>Email</dt><dd>{session.user.email}</dd><dt>Community access</dt><dd>Member</dd></dl><p>Administrative access is not automatically granted to new accounts. Owner assignment and event-management tools are still pending implementation.</p><form action={signOut}><Button variant="outline" type="submit">Sign out</Button></form></section><DiscordLinkCard link={link} status={discord} configured={configured} disconnect={unlinkDiscord} /></div>
}
