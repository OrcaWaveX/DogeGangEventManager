import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { discordLinks } from '@/lib/db/schema'
import { DISCORD_STATE_COOKIE, getOrigin, getRedirectUri } from '@/lib/discord'

export const dynamic = 'force-dynamic'

type DiscordUser = { id: string; username: string; global_name: string | null; avatar: string | null }

function finish(origin: string, status: string) {
  const response = NextResponse.redirect(new URL(`/account?discord=${status}`, origin))
  response.cookies.delete({ name: DISCORD_STATE_COOKIE, path: '/api/discord' })
  return response
}

export async function GET(request: NextRequest) {
  const origin = getOrigin(request)
  const { data: session } = await auth.getSession()
  if (!session?.user) return NextResponse.redirect(new URL('/auth/sign-in', origin))

  const params = request.nextUrl.searchParams
  const code = params.get('code')
  const state = params.get('state')
  const expectedState = request.cookies.get(DISCORD_STATE_COOKIE)?.value
  if (params.get('error')) return finish(origin, 'cancelled')
  if (!code || !state || !expectedState || state !== expectedState) return finish(origin, 'failed')

  const clientId = process.env.DISCORD_CLIENT_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET
  if (!clientId || !clientSecret) return finish(origin, 'unavailable')

  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: getRedirectUri(request),
      }),
    })
    if (!tokenResponse.ok) return finish(origin, 'failed')
    const { access_token } = (await tokenResponse.json()) as { access_token: string }

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    if (!userResponse.ok) return finish(origin, 'failed')
    const discordUser = (await userResponse.json()) as DiscordUser

    await db
      .insert(discordLinks)
      .values({
        userId: session.user.id,
        discordId: discordUser.id,
        username: discordUser.username,
        globalName: discordUser.global_name,
        avatar: discordUser.avatar,
      })
      .onConflictDoUpdate({
        target: discordLinks.userId,
        set: {
          discordId: discordUser.id,
          username: discordUser.username,
          globalName: discordUser.global_name,
          avatar: discordUser.avatar,
          linkedAt: new Date(),
        },
      })
    return finish(origin, 'linked')
  } catch (error) {
    const code = (error as { code?: string; cause?: { code?: string } })?.code ?? (error as { cause?: { code?: string } })?.cause?.code
    return finish(origin, code === '23505' ? 'in-use' : 'failed')
  }
}
