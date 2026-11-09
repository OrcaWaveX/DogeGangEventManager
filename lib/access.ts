import 'server-only'
import { redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { nightHosts } from '@/lib/db/schema'
import { isAdmin, requireViewer, type Viewer } from '@/lib/session'
import { parseUuid } from '@/lib/validation'

export type HostRole = 'lead' | 'co' | 'coordinator' | 'custom'
export type NightAccess = { admin: boolean; hostRole: HostRole | null; canRun: boolean }

const RUNNING_ROLES: HostRole[] = ['lead', 'co', 'coordinator']

export async function getNightAccess(viewer: Viewer | null, nightId: string): Promise<NightAccess> {
  if (!viewer) return { admin: false, hostRole: null, canRun: false }
  const admin = isAdmin(viewer)
  const [host] = await db
    .select({ role: nightHosts.role })
    .from(nightHosts)
    .where(and(eq(nightHosts.gameNightId, nightId), eq(nightHosts.userId, viewer.id), eq(nightHosts.status, 'accepted')))
    .limit(1)
  const hostRole = (host?.role as HostRole | undefined) ?? null
  return { admin, hostRole, canRun: admin || (hostRole !== null && RUNNING_ROLES.includes(hostRole)) }
}

export async function requireNightAccess(rawId: unknown, level: 'admin' | 'run') {
  const viewer = await requireViewer()
  const nightId = parseUuid(typeof rawId === 'string' ? rawId : null)
  if (!nightId) redirect('/')
  const access = await getNightAccess(viewer, nightId)
  const allowed = level === 'admin' ? access.admin : access.canRun
  if (!allowed) redirect('/')
  return { viewer, nightId, access }
}
