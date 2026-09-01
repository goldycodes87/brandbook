'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BrandBookMark } from '@/components/brand/BrandBookMark'
import type { AdminRoom } from '@/lib/admin-nav'

/**
 * Sidebar on desktop, bottom bar on the phone — the same rooms either way.
 *
 * Rooms are passed in already filtered by role rather than filtered here: a
 * client component deciding who sees Data would put that decision in the
 * browser, where it is a suggestion.
 */
export function AdminNav({ rooms, name, role }: { rooms: AdminRoom[]; name: string; role: string }) {
  const pathname = usePathname()
  const isOn = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  const roleLabel = role === 'co_admin' ? 'Ranch Manager' : role === 'cpa' ? 'CPA' : 'Admin'

  return (
    <>
      {/* Desktop */}
      <aside
        className="hidden md:flex flex-col fixed inset-y-0 left-0 w-[228px] z-40"
        style={{ background: 'var(--surface-1)', borderRight: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 px-5 pt-6 pb-5">
          <BrandBookMark size={26} color="var(--accent)" />
          <span
            className="type-helper px-1.5 py-0.5 rounded"
            style={{
              border: '1px solid var(--accent)', color: 'var(--accent)',
              letterSpacing: '.14em', textTransform: 'uppercase', fontSize: '.6rem',
            }}
          >
            {roleLabel}
          </span>
        </div>

        <nav className="flex-1 px-3 flex flex-col gap-1 overflow-y-auto">
          {rooms.map(r => (
            <Link
              key={r.href}
              href={r.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
              style={{
                background: isOn(r.href) ? 'var(--surface-2)' : 'transparent',
                color:      isOn(r.href) ? 'var(--text)' : 'var(--text-muted)',
              }}
            >
              <span className="w-4 text-center">{r.icon}</span>
              {r.label}
            </Link>
          ))}
        </nav>

        <div className="px-5 py-5 flex flex-col gap-2" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="type-helper truncate" style={{ color: 'var(--text-muted)' }}>{name}</span>
          {/* Plain anchor: leaving the (admin) group for (dashboard) is a
              different layout tree, and a hard load is the only navigation
              guaranteed to be running the current build. */}
          <a href="/dashboard" className="type-helper" style={{ color: 'var(--accent)' }}>
            ← Back to the ranch
          </a>
        </div>
      </aside>

      {/* Phone */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 flex overflow-x-auto"
        style={{ background: 'var(--surface-1)', borderTop: '1px solid var(--border)' }}
      >
        {rooms.map(r => (
          <Link
            key={r.href}
            href={r.href}
            className="flex-1 min-w-[68px] flex flex-col items-center gap-0.5 py-2 px-1"
            style={{ color: isOn(r.href) ? 'var(--accent)' : 'var(--text-muted)' }}
          >
            <span style={{ fontSize: 17 }}>{r.icon}</span>
            <span style={{ fontSize: 9, whiteSpace: 'nowrap' }}>{r.label.split(' ')[0]}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
