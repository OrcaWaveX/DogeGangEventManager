'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { steamLinks } from '@/lib/db/schema'

export async function unlinkSteam() {
  const { data: session } = await auth.getSession()
  if (!session?.user) throw new Error('Unauthorized')
  await db.delete(steamLinks).where(eq(steamLinks.userId, session.user.id))
  revalidatePath('/account')
}
