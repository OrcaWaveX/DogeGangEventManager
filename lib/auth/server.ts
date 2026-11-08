import 'server-only'
import { createNeonAuth } from '@neon/auth/next/server'

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
    // Cross-site preview sessions require SameSite=None; the SDK adds Secure.
    sameSite: process.env.NODE_ENV === 'development' ? 'none' : 'lax',
  },
})
