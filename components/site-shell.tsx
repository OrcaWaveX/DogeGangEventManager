'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { House, Gamepad2, Users, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { href: '/', label: 'Home', icon: House },
  { href: '/game-nights', label: 'Game Nights', icon: Gamepad2 },
  { href: '/community', label: 'Community', icon: Users },
  { href: '/account', label: 'Account', icon: UserRound },
]

export function SiteShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  return (
    <div className="site-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <img src="/images/dg-logo.png" alt="" width={42} height={42} />
          <span>DogeGang<span className="brand-plus">+</span></span>
        </Link>
        <nav aria-label="Main navigation">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={path === href ? 'page' : undefined}
              className={cn('nav-link', path === href && 'nav-active')}
            >
              <Icon size={18} />
              {label}
              {path === href && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="page-column">
        <header className="topbar">
          <span className="breadcrumb">{navigation.find((n) => n.href === path)?.label ?? 'DogeGang+'}</span>
          <Link href="/account" className="small-link">Account</Link>
        </header>
        <main id="main-content">{children}</main>
        <footer><span>© {new Date().getFullYear()} DogeGang+</span></footer>
      </div>
    </div>
  )
}
