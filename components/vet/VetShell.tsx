'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Beef, Folder, MessageSquare, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import { apiDelete } from '@/lib/fetch'

const NAV = [
  { href: '/vet/dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/vet/animals',   label: 'Animals',     icon: Beef },
  { href: '/vet/cases',     label: 'Cases',       icon: Folder },
  { href: '/vet/messages',  label: 'Messages',    icon: MessageSquare },
]

async function doLogout() {
  await apiDelete('/api/vet/session')
  window.location.href = '/'
}

export function VetShell({ children, vetName }: { children: ReactNode; vetName?: string }) {
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="min-h-dvh flex" style={{ backgroundColor: 'var(--surface-0)' }}>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-56" style={{ backgroundColor: 'var(--surface-1)', borderRight: '1px solid var(--border)', zIndex: 40 }}>
        {/* Wordmark */}
        <div className="px-5 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <h1 className="text-xl font-bold font-display tracking-tight">
            <span style={{ color: 'var(--accent)' }}>Brand</span>
            <span style={{ color: 'var(--text)' }}>Book</span>
          </h1>
          <p className="text-xs tracking-wider uppercase mt-0.5" style={{ color: 'var(--text-muted)' }}>Vet Portal</p>
          {vetName && <p className="type-helper mt-1 truncate" style={{ color: 'var(--text-secondary)' }}>{vetName}</p>}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive(href)
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)]',
              )}
              style={isActive(href) ? { backgroundColor: 'var(--accent-bg)' } : {}}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="px-3 py-4" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={doLogout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-medium transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 md:ml-56 flex flex-col min-h-dvh">
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 flex items-stretch z-40"
        style={{ backgroundColor: 'var(--surface-1)', borderTop: '1px solid var(--border)' }}
      >
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center gap-1 flex-1 py-2 text-[10px] font-medium transition-colors',
              isActive(href) ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]',
            )}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
