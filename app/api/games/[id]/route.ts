import { NextResponse } from 'next/server'
import { getViewer } from '@/lib/session'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ error: 'Sign in to view game details.' }, { status: 401 })

  const { id } = await params
  if (!/^\d{1,9}$/.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  const key = process.env.RAWG_API_KEY
  if (!key) return NextResponse.json({ error: 'Game search is not configured.' }, { status: 503 })

  try {
    const response = await fetch(`https://api.rawg.io/api/games/${id}?key=${key}`, { next: { revalidate: 86400 } })
    if (!response.ok) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
    const data = (await response.json()) as { description_raw?: string; released?: string | null; rating?: number; website?: string }
    return NextResponse.json({
      description: (data.description_raw ?? '').slice(0, 600),
      released: data.released ?? null,
      rating: data.rating ?? null,
    })
  } catch {
    return NextResponse.json({ error: 'Details unavailable.' }, { status: 502 })
  }
}
