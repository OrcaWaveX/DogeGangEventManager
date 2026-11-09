import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { SiteShell } from '@/components/site-shell'
import { unreadCount } from '@/lib/notifications'
import { getViewer, isAdmin } from '@/lib/session'

export const metadata: Metadata = {
  title: 'DogeGang+ Game Nights',
  description: 'Game night scheduling, voting, and RSVPs for DogeGang+.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#101113',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const viewer = await getViewer()
  const roleLabel = viewer?.role === 'owner' ? 'Owner' : viewer?.role === 'admin' ? 'Admin' : 'Member'
  const unread = viewer ? await unreadCount(viewer.id) : 0
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <a href="#main-content" className="skip-link">Skip to content</a>
        <SiteShell viewer={viewer ? { name: viewer.name, roleLabel } : null} isAdmin={isAdmin(viewer)} unread={unread}>
          {children}
        </SiteShell>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
