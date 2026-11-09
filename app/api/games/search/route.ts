import { NextResponse, type NextRequest } from 'next/server'
import { fromRawg } from '@/lib/games'
import { getViewer } from '@/lib/session'

export async function GET(request: NextRequest) {
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ error: 'Sign in to search games.' }, { status: 401 })

  const query = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 80)
  if (query.length < 2) return NextResponse.json({ results: [] })
  const key = process.env.RAWG_API_KEY
  if (!key) return NextResponse.json({ error: 'Game search is not configured.' }, { status: 503 })

  const url = new URL('https://api.rawg.io/api/games')
  url.searchParams.set('key', key)
  url.searchParams.set('search', query)
  url.searchParams.set('page_size', '12')
  url.searchParams.set('search_precise', 'true')

  try {
    const response = await fetch(url, { next: { revalidate: 3600 } })
    if (!response.ok) return NextResponse.json({ error: 'Game search is unavailable right now.' }, { status: 502 })
    const data = (await response.json()) as { results?: Parameters<typeof fromRawg>[0][] }
    return NextResponse.json({ results: (data.results ?? []).map(fromRawg) })
  } catch {
    return NextResponse.json({ error: 'Game search is unavailable right now.' }, { status: 502 })
  }
}
