'use client'

import { cn } from '@/lib/utils'
import Link from 'next/link'

interface Tab {
  label: string
  value?: string
  href?: string
  count?: number
}

interface TabsProps {
  tabs: Tab[]
  active?: string
  onChange?: (value: string) => void
  className?: string
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div
      style={{ borderColor: 'var(--border)' }}
      className={cn('flex items-end gap-0 border-b overflow-x-auto', className)}
    >
      {tabs.map(tab => {
        const isActive = active === (tab.value ?? tab.label)
        const content = (
          <>
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                style={{ backgroundColor: 'var(--surface-3)', color: 'var(--text-muted)' }}
                className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] leading-none"
              >
                {tab.count}
              </span>
            )}
          </>
        )
        const sharedClass = cn(
          'flex items-center px-4 py-2.5 -mb-px border-b-2 type-nav-item whitespace-nowrap transition-colors duration-150',
          isActive
            ? 'border-[var(--accent)] text-[var(--accent)]'
            : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]',
        )
        if (tab.href) {
          return <Link key={tab.label} href={tab.href} className={sharedClass}>{content}</Link>
        }
        return (
          <button
            key={tab.label}
            onClick={() => onChange?.(tab.value ?? tab.label)}
            className={sharedClass}
          >
            {content}
          </button>
        )
      })}
    </div>
  )
}

export default Tabs
