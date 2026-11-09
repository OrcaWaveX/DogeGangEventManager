import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

export type PublicUser = { id: string; name: string; avatarUrl: string | null }

export async function getUsers(ids: string[]): Promise<Map<string, PublicUser>> {
  const unique = [...new Set(ids)].filter(Boolean)
  const map = new Map<string, PublicUser>()
  if (!unique.length) return map
  try {
    const result = await db.execute<{ id: string; name: string | null; avatar_url: string | null }>(
      sql`select u.id::text as id, u.name, s.avatar_url
          from neon_auth."user" u
          left join steam_links s on s."userId" = u.id::text
          where u.id::text in (${sql.join(unique.map((id) => sql`${id}`), sql`, `)})`,
    )
    for (const row of result.rows) map.set(row.id, { id: row.id, name: row.name || 'Member', avatarUrl: row.avatar_url })
  } catch (error) {
    console.error('[v0] Could not load users', error instanceof Error ? error.message : 'Unknown failure')
  }
  for (const id of unique) if (!map.has(id)) map.set(id, { id, name: 'Member', avatarUrl: null })
  return map
}

export async function listMembers(): Promise<PublicUser[]> {
  try {
    const result = await db.execute<{ id: string; name: string | null; email: string | null; avatar_url: string | null }>(
      sql`select u.id::text as id, u.name, u.email, s.avatar_url
          from neon_auth."user" u
          left join steam_links s on s."userId" = u.id::text
          order by lower(u.name) limit 500`,
    )
    return result.rows.map((row) => ({ id: row.id, name: row.name || row.email || 'Member', avatarUrl: row.avatar_url }))
  } catch (error) {
    console.error('[v0] Could not list members', error instanceof Error ? error.message : 'Unknown failure')
    return []
  }
}
