import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth/server'
import { STEAM_OPENID_URL, STEAM_STATE_COOKIE, originFrom } from '@/lib/steam'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const origin = originFrom(request.headers)
  const { data: session } = await auth.getSession()
  if (!session?.user) return NextResponse.redirect(`${origin}/auth/sign-in`)

  const state = crypto.randomUUID()
  const identifier = 'http://specs.openid.net/auth/2.0/identifier_select'
  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': `${origin}/api/steam/callback?state=${state}`,
    'openid.realm': origin,
    'openid.identity': identifier,
    'openid.claimed_id': identifier,
  })

  const response = NextResponse.redirect(`${STEAM_OPENID_URL}?${params}`)
  response.cookies.set(STEAM_STATE_COOKIE, state, {
    httpOnly: true,
    secure: origin.startsWith('https'),
    sameSite: 'lax',
    path: '/api/steam',
    maxAge: 600,
  })
  return response
}
