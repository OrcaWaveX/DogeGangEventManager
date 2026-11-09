import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { userGames } from '@/lib/db/schema'
import type { PickedGame } from '@/lib/games'

export type LibraryGame = PickedGame & { favorite: boolean }

export async function getLibrary(userId: string | null): Promise<LibraryGame[]> {
  if (!userId) return []
  try {
    const rows = await db.select().from(userGames).where(eq(userGames.userId, userId)).orderBy(desc(userGames.favorite), desc(userGames.lastUsedAt)).limit(30)
    return rows.map((row) => ({
      source: row.source === 'rawg' ? 'rawg' : 'custom',
      externalId: row.externalId,
      name: row.name,
      coverUrl: row.coverUrl,
      backgroundUrl: row.backgroundUrl,
      genres: (row.genres as string[]) ?? [],
      platforms: (row.platforms as string[]) ?? [],
      favorite: row.favorite,
    }))
  } catch {
    return []
  }
}
