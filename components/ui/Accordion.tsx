'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

interface AccordionSectionProps {
  title: string
  defaultOpen?: boolean
  children: ReactNode
  summary?: string
}

export function AccordionSection({ title, defaultOpen = false, children, summary }: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div
      className="rounded-[var(--radius-lg)] overflow-hidden"
      style={{ border: '1px solid var(--border)' }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
        style={{ backgroundColor: open ? 'var(--surface-2)' : 'var(--surface-1)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="type-section-label" style={{ color: 'var(--text)' }}>{title}</span>
          {!open && summary && (
            <span className="type-helper truncate" style={{ color: 'var(--text-muted)' }}>{summary}</span>
          )}
        </div>
        <ChevronDown
          size={16}
          style={{
            color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
            flexShrink: 0,
            marginLeft: 8,
          }}
        />
      </button>

      {open && (
        <div
          className="px-4 pt-3 pb-4 flex flex-col gap-3"
          style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface-1)' }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
