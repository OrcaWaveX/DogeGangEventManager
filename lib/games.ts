export type PickedGame = {
  source: 'rawg' | 'custom'
  externalId: string
  name: string
  coverUrl: string | null
  backgroundUrl: string | null
  genres: string[]
  platforms: string[]
}

type RawgGame = {
  id: number
  name: string
  background_image: string | null
  genres?: { name: string }[]
  platforms?: { platform: { name: string } }[] | null
}

function crop(url: string | null, size: string) {
  if (!url) return null
  return url.includes('/media/games/') ? url.replace('/media/games/', `/media/crop/${size}/games/`) : url
}

export function fromRawg(game: RawgGame): PickedGame {
  return {
    source: 'rawg',
    externalId: String(game.id),
    name: game.name,
    coverUrl: crop(game.background_image, '600/400'),
    backgroundUrl: crop(game.background_image, '1280/720'),
    genres: (game.genres ?? []).map((genre) => genre.name).slice(0, 4),
    platforms: (game.platforms ?? []).map((item) => item.platform.name).slice(0, 6),
  }
}

export function customGame(name: string): PickedGame {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'game'
  return { source: 'custom', externalId: `custom-${slug}`, name, coverUrl: null, backgroundUrl: null, genres: [], platforms: [] }
}

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function cleanUrl(value: unknown) {
  const text = clean(value, 500)
  try {
    return text && new URL(text).protocol === 'https:' ? text : null
  } catch {
    return null
  }
}

function cleanList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map((item) => item.slice(0, 40)).slice(0, 8) : []
}

export function parsePickedGame(value: unknown): PickedGame | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const name = clean(raw.name, 80)
  const externalId = clean(raw.externalId, 80)
  const source = raw.source === 'rawg' ? 'rawg' : raw.source === 'custom' ? 'custom' : null
  if (!name || !externalId || !source) return null
  return {
    source,
    externalId,
    name,
    coverUrl: cleanUrl(raw.coverUrl),
    backgroundUrl: cleanUrl(raw.backgroundUrl),
    genres: cleanList(raw.genres),
    platforms: cleanList(raw.platforms),
  }
}
