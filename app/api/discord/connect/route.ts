import { randomBytes } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth/server'
import { DISCORD_STATE_COOKIE, getOrigin, getRedirectUri } from '@/lib/discord'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const origin = getOrigin(request)
  const { data: session } = await auth.getSession()
  if (!session?.user) return NextResponse.redirect(new URL('/auth/sign-in', origin))

  const clientId = process.env.DISCORD_CLIENT_ID
  if (!clientId) return NextResponse.redirect(new URL('/account?discord=unavailable', origin))

  const state = randomBytes(24).toString('base64url')
  const authorizeUrl = new URL('https://discord.com/oauth2/authorize')
  authorizeUrl.searchParams.set('client_id', clientId)
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('scope', 'identify')
  authorizeUrl.searchParams.set('redirect_uri', getRedirectUri(request))
  authorizeUrl.searchParams.set('state', state)

  const response = NextResponse.redirect(authorizeUrl)
  response.cookies.set(DISCORD_STATE_COOKIE, state, {
    httpOnly: true,
    secure: origin.startsWith('https://'),
    sameSite: 'lax',
    path: '/api/discord',
    maxAge: 600,
  })
  return response
}
