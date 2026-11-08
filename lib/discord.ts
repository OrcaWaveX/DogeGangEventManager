import 'server-only'
import type { NextRequest } from 'next/server'

export const DISCORD_STATE_COOKIE = 'discord_oauth_state'

export function getOrigin(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? request.nextUrl.host
  const proto = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '')
  return `${proto}://${host}`
}

export function getRedirectUri(request: NextRequest) {
  return `${getOrigin(request)}/api/discord/callback`
}

export function discordAvatarUrl(discordId: string, avatar: string | null) {
  return avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=64` : null
}
