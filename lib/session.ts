import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { memberRoles } from '@/lib/db/schema'

export type Role = 'owner' | 'admin' | 'member'
export type Viewer = { id: string; name: string; email: string; role: Role }

export const getViewer = cache(async (): Promise<Viewer | null> => {
  let session
  try {
    session = (await auth.getSession()).data
  } catch (error) {
    console.error('[v0] Could not read session', error instanceof Error ? error.message : 'Unknown failure')
    return null
  }
  if (!session?.user) return null

  let role: Role = 'member'
  try {
    const [row] = await db.select().from(memberRoles).where(eq(memberRoles.userId, session.user.id)).limit(1)
    if (row?.role === 'owner' || row?.role === 'admin') role = row.role
  } catch (error) {
    console.error('[v0] Could not load member role', error instanceof Error ? error.message : 'Unknown failure')
  }
  return { id: session.user.id, name: session.user.name, email: session.user.email, role }
})

export const isAdmin = (viewer: Viewer | null) => viewer?.role === 'owner' || viewer?.role === 'admin'

export async function requireViewer() {
  const viewer = await getViewer()
  if (!viewer) redirect('/auth/sign-in')
  return viewer
}

export async function requireAdmin() {
  const viewer = await requireViewer()
  if (!isAdmin(viewer)) redirect('/')
  return viewer
}

export async function requireOwner() {
  const viewer = await requireViewer()
  if (viewer.role !== 'owner') redirect('/admin')
  return viewer
}
