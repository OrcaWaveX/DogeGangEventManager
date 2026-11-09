'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, Gamepad2, ShieldCheck, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'

type ShellViewer = { name: string; roleLabel: string } | null

export function SiteShell({
  children,
  viewer,
  isAdmin,
  unread = 0,
}: {
  children: React.ReactNode
  viewer: ShellViewer
  isAdmin: boolean
  unread?: number
}) {
  const path = usePathname()
  const navigation = [
    { href: '/', label: 'Game Nights', icon: Gamepad2, active: path === '/' || path.startsWith('/game-nights'), badge: 0 },
    ...(viewer ? [{ href: '/notifications', label: 'Notifications', icon: Bell, active: path.startsWith('/notifications'), badge: unread }] : []),
    ...(isAdmin ? [{ href: '/admin', label: 'Admin', icon: ShieldCheck, active: path.startsWith('/admin'), badge: 0 }] : []),
    { href: '/account', label: 'Account', icon: UserRound, active: path.startsWith('/account'), badge: 0 },
  ]

  return (
    <div className="site-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <img src="/images/dg-logo.png" alt="" width={40} height={40} />
          <span>
            DogeGang<span className="brand-plus">+</span>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          {navigation.map(({ href, label, icon: Icon, active, badge }) => (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn('nav-link', active && 'nav-active')}
              aria-label={badge ? `${label}, ${badge} unread` : label}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
              {badge > 0 && <span className="nav-badge" aria-hidden="true">{badge > 9 ? '9+' : badge}</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          {viewer ? (
            <Link href="/account" className="viewer-chip" aria-label={`Signed in as ${viewer.name}`}>
              <span className="viewer-avatar" aria-hidden="true">{viewer.name.slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{viewer.name}</strong>
                <small>{viewer.roleLabel}</small>
              </div>
            </Link>
          ) : (
            <Link href="/auth/sign-in" className="viewer-chip" aria-label="Sign in">
              <span className="viewer-avatar" aria-hidden="true">?</span>
              <div>
                <strong>Sign in</strong>
                <small>to RSVP and vote</small>
              </div>
            </Link>
          )}
        </div>
      </aside>
      <div className="page-column">
        <div className="rainbow-line" aria-hidden="true" />
        <main id="main-content">{children}</main>
        <footer>© {new Date().getFullYear()} DogeGang+</footer>
      </div>
    </div>
  )
}
