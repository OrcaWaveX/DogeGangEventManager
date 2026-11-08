import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { steamLinks } from '@/lib/db/schema'
import {
  STEAM_ID_PATTERN,
  STEAM_OPENID_URL,
  STEAM_STATE_COOKIE,
  fetchSteamProfile,
  originFrom,
} from '@/lib/steam'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const origin = originFrom(request.headers)
  const finish = (status: string) => {
    const response = NextResponse.redirect(`${origin}/account?steam=${status}`)
    response.cookies.delete({ name: STEAM_STATE_COOKIE, path: '/api/steam' })
    return response
  }

  const { data: session } = await auth.getSession()
  if (!session?.user) return NextResponse.redirect(`${origin}/auth/sign-in`)

  const query = request.nextUrl.searchParams
  const state = query.get('state')
  const expectedState = request.cookies.get(STEAM_STATE_COOKIE)?.value
  if (!state || !expectedState || state !== expectedState) return finish('error')

  const openid = new URLSearchParams()
  for (const [name, value] of query) {
    if (name.startsWith('openid.')) openid.set(name, value)
  }
  if (openid.get('openid.mode') === 'cancel') return finish('cancelled')
  if (openid.get('openid.mode') !== 'id_res') return finish('error')
  if (openid.get('openid.return_to') !== `${origin}/api/steam/callback?state=${state}`) return finish('error')

  const steamId = STEAM_ID_PATTERN.exec(openid.get('openid.claimed_id') ?? '')?.[1]
  if (!steamId) return finish('error')

  openid.set('openid.mode', 'check_authentication')
  try {
    const verification = await fetch(STEAM_OPENID_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: openid,
      cache: 'no-store',
    })
    const text = await verification.text()
    if (!verification.ok || !/is_valid\s*:\s*true/.test(text)) return finish('error')
  } catch (error) {
    console.error('[v0] Steam verification failed', error instanceof Error ? error.message : 'Unknown failure')
    return finish('error')
  }

  const profile = await fetchSteamProfile(steamId)
  try {
    await db
      .insert(steamLinks)
      .values({ userId: session.user.id, steamId, ...profile })
      .onConflictDoUpdate({
        target: steamLinks.userId,
        set: { steamId, ...profile, linkedAt: new Date() },
      })
  } catch (error) {
    const code = (error as { code?: string }).code
    if (code === '23505') return finish('taken')
    console.error('[v0] Saving Steam link failed', error instanceof Error ? error.message : 'Unknown failure')
    return finish('error')
  }

  return finish('linked')
}
