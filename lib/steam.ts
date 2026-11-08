import 'server-only'

export const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login'
export const STEAM_STATE_COOKIE = 'steam_link_state'
export const STEAM_ID_PATTERN = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/

export function originFrom(headers: Headers) {
  const host = headers.get('x-forwarded-host') ?? headers.get('host') ?? 'localhost:3000'
  const forwardedProto = headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const proto = forwardedProto ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export type SteamProfile = {
  personaName: string | null
  avatarUrl: string | null
  profileUrl: string | null
}

export async function fetchSteamProfile(steamId: string): Promise<SteamProfile> {
  const empty: SteamProfile = { personaName: null, avatarUrl: null, profileUrl: null }
  const key = process.env.STEAM_API_KEY
  if (!key) return empty
  try {
    const url = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/')
    url.searchParams.set('key', key)
    url.searchParams.set('steamids', steamId)
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) {
      console.error('[v0] Steam profile lookup failed with status', response.status)
      return empty
    }
    const body = (await response.json()) as {
      response?: { players?: { personaname?: string; avatarfull?: string; profileurl?: string }[] }
    }
    const player = body.response?.players?.[0]
    return {
      personaName: player?.personaname ?? null,
      avatarUrl: player?.avatarfull ?? null,
      profileUrl: player?.profileurl ?? null,
    }
  } catch (error) {
    console.error('[v0] Steam profile lookup failed', error instanceof Error ? error.message : 'Unknown failure')
    return empty
  }
}
