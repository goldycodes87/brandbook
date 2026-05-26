'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Beef,
  Stethoscope,
  GitBranch,
  BarChart2,
  ShoppingCart,
  MapPin,
  FileText,
  CreditCard,
  Package,
  Settings,
  MoreHorizontal,
  X,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/animals',      label: 'Animals',      icon: Beef },
  { href: '/health',       label: 'Health',       icon: Stethoscope },
  { href: '/reproduction', label: 'Reproduction', icon: GitBranch },
  { href: '/genetics',     label: 'Genetics',     icon: BarChart2 },
  { href: '/performance',  label: 'Performance',  icon: BarChart2 },
  { href: '/sales',        label: 'Sales',        icon: ShoppingCart },
  { href: '/grazing',      label: 'Grazing',      icon: MapPin },
  { href: '/leases',       label: 'Leases',       icon: FileText },
  { href: '/billing',      label: 'Billing',      icon: CreditCard },
  { href: '/inventory',    label: 'Inventory',    icon: Package },
  { href: '/settings',     label: 'Settings',     icon: Settings },
]

const BOTTOM_TABS = NAV_ITEMS.slice(0, 4)

async function handleLogout() {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/login'
}

function NavItem({ href, label, icon: Icon, active, onClick }: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
        active
          ? 'bg-brand-orange/15 text-brand-orange'
          : 'text-brand-white/50 hover:text-brand-white hover:bg-brand-surface-2',
      )}
    >
      <Icon className="w-4.5 h-4.5 flex-shrink-0" />
      <span>{label}</span>
    </Link>
  )
}

function BottomTab({ href, label, icon: Icon, active }: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex flex-col items-center gap-1 flex-1 py-2 text-[10px] font-medium transition-colors',
        active ? 'text-brand-orange' : 'text-brand-white/40',
      )}
    >
      <Icon className={cn('w-5 h-5', active && 'drop-shadow-[0_0_6px_rgba(234,88,12,0.6)]')} />
      <span>{label}</span>
    </Link>
  )
}

export default function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="min-h-dvh flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-60 bg-brand-surface border-r border-brand-gray/20 z-40">
        {/* Wordmark */}
        <div className="px-5 py-5 border-b border-brand-gray/20">
          <h1 className="text-xl font-bold font-display tracking-tight">
            <span className="text-brand-orange">Brand</span>
            <span className="text-brand-white">Book</span>
          </h1>
          <p className="text-brand-white/25 text-xs tracking-wider uppercase mt-0.5">Ranch OS</p>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <NavItem
              key={item.href}
              {...item}
              active={isActive(item.href)}
            />
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-brand-gray/20">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-medium text-brand-white/40 hover:text-red-400 hover:bg-red-900/10 transition-colors"
          >
            <LogOut className="w-4.5 h-4.5 flex-shrink-0" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-dvh">
        {/* Desktop topbar */}
        <header className="hidden md:flex items-center justify-between px-6 py-4 border-b border-brand-gray/20 sticky top-0 bg-brand-black/90 backdrop-blur-sm z-30">
          <h2 className="text-sm font-medium text-brand-white/50">
            {NAV_ITEMS.find(n => isActive(n.href))?.label ?? 'BrandBook'}
          </h2>
        </header>

        {/* Page content */}
        <main className="flex-1 pb-20 md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 flex items-stretch bg-brand-surface border-t border-brand-gray/20 z-40 safe-area-pb">
        {BOTTOM_TABS.map(item => (
          <BottomTab
            key={item.href}
            {...item}
            active={isActive(item.href)}
          />
        ))}

        {/* More button */}
        <button
          onClick={() => setMoreOpen(true)}
          className={cn(
            'flex flex-col items-center gap-1 flex-1 py-2 text-[10px] font-medium transition-colors',
            moreOpen ? 'text-brand-orange' : 'text-brand-white/40',
          )}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span>More</span>
        </button>
      </nav>

      {/* More sheet (mobile) */}
      {moreOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-50"
            onClick={() => setMoreOpen(false)}
          />
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-brand-surface rounded-t-2xl z-50 safe-area-pb">
            <div className="flex items-center justify-between px-5 py-4 border-b border-brand-gray/20">
              <span className="font-semibold text-brand-white">More</span>
              <button onClick={() => setMoreOpen(false)}>
                <X className="w-5 h-5 text-brand-white/50" />
              </button>
            </div>
            <nav className="px-3 py-3 space-y-0.5">
              {NAV_ITEMS.slice(4).map(item => (
                <NavItem
                  key={item.href}
                  {...item}
                  active={isActive(item.href)}
                  onClick={() => setMoreOpen(false)}
                />
              ))}
            </nav>
            <div className="px-3 py-3 border-t border-brand-gray/20">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-medium text-brand-white/40 hover:text-red-400 hover:bg-red-900/10 transition-colors"
              >
                <LogOut className="w-4.5 h-4.5 flex-shrink-0" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
