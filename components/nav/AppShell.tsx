'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Tag, Heart, Baby,
  MapPin, DollarSign, Dna, TrendingUp,
  ShoppingCart, Package, Settings,
  MoreHorizontal, X, LogOut, Bell, FileBarChart,
  Sparkles, Receipt, Leaf,
} from 'lucide-react'
import { apiFetch, apiGet } from '@/lib/fetch'
import { QuickExpenseButton } from '@/components/expenses/QuickExpenseButton'

// Grouped by what you are doing, not alphabetically. Somebody looking for a
// receipt is thinking about money, not about the letter R.
const NAV_GROUPS = [
  { title: null, items: [
    { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
    { href: '/ai',           label: 'Ask',          icon: Sparkles },
  ] },
  { title: 'The herd', items: [
    { href: '/animals',      label: 'Animals',      icon: Tag },
    { href: '/health',       label: 'Health',       icon: Heart },
    { href: '/reproduction', label: 'Reproduction', icon: Baby },
    { href: '/genetics',     label: 'Genetics',     icon: Dna },
  ] },
  { title: 'The land', items: [
    { href: '/grazing',      label: 'Grazing',      icon: Leaf },
    { href: '/leases',       label: 'Leases',       icon: MapPin },
  ] },
  { title: 'Money', items: [
    { href: '/expenses/review', label: 'Receipts',  icon: Receipt },
    { href: '/billing',      label: 'Billing',      icon: DollarSign },
    { href: '/sales',        label: 'Sales',        icon: ShoppingCart },
  ] },
  { title: 'Looking back', items: [
    { href: '/performance',  label: 'Performance',  icon: TrendingUp },
    { href: '/inventory',    label: 'Inventory',    icon: Package },
    { href: '/reports',      label: 'Reports',      icon: FileBarChart },
  ] },
]

const NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items)

const SETTINGS_ITEM = { href: '/settings', label: 'Settings', icon: Settings }

/**
 * The three tabs on a phone, named rather than indexed.
 *
 * This used to be NAV_ITEMS[0..2] with comments saying Dashboard, Animals,
 * Health — so regrouping the sidebar silently changed what sits under your
 * thumb, and the comments went on claiming otherwise. Naming them means the
 * sidebar can be reordered freely and this stays put.
 */
const BOTTOM_TAB_HREFS = ['/dashboard', '/animals', '/health']
const BOTTOM_TABS = BOTTOM_TAB_HREFS
  .map(href => NAV_ITEMS.find(i => i.href === href))
  .filter((i): i is (typeof NAV_ITEMS)[number] => Boolean(i))

const ROUTE_TITLES: Record<string, string> = Object.fromEntries(
  [...NAV_ITEMS, SETTINGS_ITEM].map(n => [n.href, n.label])
)

async function handleLogout() {
  await apiFetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/login'
}

function NavLink({ href, label, icon: Icon, active, onClick, badge }: {
  href: string; label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  active: boolean; onClick?: () => void; badge?: number
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      style={active
        ? { backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }
        : { color: 'var(--text-muted)' }
      }
      className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-lg)] transition-colors duration-150 hover:text-[var(--text)] hover:bg-[var(--surface-2)]"
    >
      <Icon size={18} />
      <span className="type-nav-item flex-1">{label}</span>
      {badge ? (
        <span
          style={{ background: 'var(--accent)', color: '#fff' }}
          className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[10px] font-bold"
        >
          {badge}
        </span>
      ) : null}
    </Link>
  )
}

function MoreTile({ href, label, icon: Icon, active, onClick }: {
  href: string; label: string
  icon: React.ComponentType<{ size?: number }>
  active: boolean; onClick: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      style={active
        ? { backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--accent-border)' }
        : { backgroundColor: 'var(--surface-3)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }
      }
      className="flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-[var(--radius-xl)] border transition-colors duration-150"
    >
      <Icon size={22} />
      <span className="type-nav-item text-[0.65rem]">{label}</span>
    </Link>
  )
}

function BottomTab({ href, label, icon: Icon, active }: {
  href: string; label: string
  icon: React.ComponentType<{ size?: number }>
  active: boolean
}) {
  return (
    <Link
      href={href}
      style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}
      className="flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors duration-150"
    >
      <Icon size={20} />
      <span className="type-nav-item text-[0.55rem]">{label}</span>
    </Link>
  )
}

function Topbar({ title }: { title: string }) {
  return (
    <>
      {/* Mobile topbar */}
      <header
        style={{ backgroundColor: 'var(--surface-1)', borderColor: 'var(--border)' }}
        className="xl:hidden flex items-center justify-between px-4 h-14 border-b sticky top-0 z-30"
      >
        <div className="flex items-end gap-0 leading-none">
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent)' }}>BRAND</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 400, color: 'var(--text)' }}>BOOK</span>
        </div>
        <button style={{ color: 'var(--text-muted)' }} aria-label="Notifications">
          <Bell size={20} />
        </button>
      </header>
      {/* Desktop topbar */}
      <header
        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        className="hidden xl:flex items-center justify-between px-6 h-14 border-b sticky top-0 z-30 backdrop-blur-sm"
      >
        <span className="type-page-title text-base">{title}</span>
        <div className="flex items-center gap-3">
          <button style={{ color: 'var(--text-muted)' }} aria-label="Notifications">
            <Bell size={18} />
          </button>
          <div
            style={{ backgroundColor: 'var(--accent)', color: 'white' }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
          >
            G
          </div>
        </div>
      </header>
    </>
  )
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const [receipts, setReceipts] = useState(0)

  // Receipts waiting to be looked at. A receipt forwarded from a feed store
  // on Monday has to come and find you on Wednesday; a number in the nav is
  // what does that.
  useEffect(() => {
    const read = () => apiGet('/api/expenses/review/count')
      .then(r => r.json()).then(d => setReceipts(d.count ?? 0)).catch(() => {})
    read()
    const t = setInterval(read, 60_000)
    return () => clearInterval(t)
  }, [])

  if (pathname.startsWith('/chute')) return <>{children}</>

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const pageTitle = ROUTE_TITLES[pathname] ?? ROUTE_TITLES[Object.keys(ROUTE_TITLES).find(k => pathname.startsWith(k + '/')) ?? ''] ?? 'Brand Book'

  return (
    <div className="min-h-dvh flex">
      {/* Desktop sidebar */}
      <aside
        style={{
          width: 'var(--sidebar-w)',
          backgroundColor: 'var(--surface-1)',
          borderColor: 'var(--border)',
        }}
        className="hidden xl:flex flex-col fixed left-0 top-0 bottom-0 border-r z-40"
      >
        {/* Logo area */}
        <div style={{ borderColor: 'var(--border)', height: '4rem' }} className="flex flex-col justify-center px-5 border-b flex-shrink-0">
          <div className="flex items-end gap-0 leading-none">
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)' }}>BRAND</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 400, color: 'var(--text)' }}>BOOK</span>
          </div>
          <p className="type-section-label mt-0.5">Ranch OS</p>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.title ?? 'top'} className={gi === 0 ? 'space-y-0.5' : 'mt-5 space-y-0.5'}>
              {group.title && (
                <p className="type-section-label px-3 pb-1.5" style={{ color: 'var(--text-disabled)' }}>
                  {group.title}
                </p>
              )}
              {group.items.map(item => (
                <NavLink
                  key={item.href}
                  {...item}
                  active={isActive(item.href)}
                  badge={item.href === '/expenses/review' ? (receipts || undefined) : undefined}
                />
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom: settings + user */}
        <div style={{ borderColor: 'var(--border)' }} className="px-3 py-3 border-t space-y-0.5">
          <NavLink {...SETTINGS_ITEM} active={isActive(SETTINGS_ITEM.href)} />
          <button
            onClick={handleLogout}
            style={{ color: 'var(--text-muted)' }}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-[var(--radius-lg)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--danger-fg)]"
          >
            <LogOut size={18} />
            <span className="type-nav-item">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div
        style={{ marginLeft: 0 }}
        className="flex-1 xl:ml-[var(--sidebar-w)] flex flex-col min-h-dvh"
      >
        <Topbar title={pageTitle} />
        <main
          className="flex-1 pb-[var(--bottomnav-h)] xl:pb-0"
          style={{ backgroundColor: 'var(--surface-0)' }}
        >
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        style={{
          height: 'var(--bottomnav-h)',
          backgroundColor: 'var(--surface-1)',
          borderColor: 'var(--border)',
        }}
        className="xl:hidden fixed bottom-0 left-0 right-0 flex items-stretch border-t z-40"
      >
        {BOTTOM_TABS.map(item => (
          <BottomTab key={item.href} {...item} active={isActive(item.href)} />
        ))}

        {/* More */}
        <button
          onClick={() => setMoreOpen(true)}
          style={{ color: moreOpen ? 'var(--accent)' : 'var(--text-muted)' }}
          className="flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors"
        >
          <MoreHorizontal size={20} />
          <span className="type-nav-item text-[0.55rem]">More</span>
        </button>

        {/* Settings tab */}
        <BottomTab {...SETTINGS_ITEM} active={isActive(SETTINGS_ITEM.href)} />
      </nav>

      <QuickExpenseButton />

      {/* More sheet overlay */}
      {moreOpen && (
        <>
          <div
            className="xl:hidden fixed inset-0 z-50"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setMoreOpen(false)}
          />
          <div
            style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}
            className="xl:hidden fixed bottom-0 left-0 right-0 rounded-t-2xl z-50 border-t"
          >
            <div style={{ borderColor: 'var(--border)' }} className="flex items-center justify-between px-5 py-4 border-b">
              <span className="type-panel-title">MORE</span>
              <button onClick={() => setMoreOpen(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>
            <div className="p-4 grid grid-cols-4 gap-2 pb-safe">
              {[...NAV_ITEMS.slice(3), SETTINGS_ITEM].map(item => (
                <MoreTile
                  key={item.href}
                  {...item}
                  active={isActive(item.href)}
                  onClick={() => setMoreOpen(false)}
                />
              ))}
            </div>
            <div style={{ borderColor: 'var(--border)' }} className="px-4 pb-5 pt-2 border-t">
              <button
                onClick={handleLogout}
                style={{ color: 'var(--danger-fg)' }}
                className="flex items-center gap-3 px-3 py-2.5 w-full rounded-[var(--radius-lg)] type-nav-item"
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
