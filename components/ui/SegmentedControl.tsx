'use client'

import { cn } from '@/lib/utils'

interface Segment {
  label: string
  value: string
  icon?: React.ReactNode
}

interface SegmentedControlProps {
  segments: Segment[]
  value: string
  onChange: (value: string) => void
  size?: 'sm' | 'md'
  className?: string
}

export function SegmentedControl({ segments, value, onChange, size = 'sm', className }: SegmentedControlProps) {
  return (
    <div
      style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}
      className={cn('inline-flex items-center gap-0.5 p-0.5 rounded-[var(--radius-lg)] border', className)}
    >
      {segments.map(seg => {
        const active = seg.value === value
        return (
          <button
            key={seg.value}
            onClick={() => onChange(seg.value)}
            style={active ? { backgroundColor: 'var(--surface-1)', color: 'var(--text)', boxShadow: 'var(--shadow-sm)' } : { color: 'var(--text-muted)' }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[var(--radius-md)] transition-all duration-150 type-button',
              size === 'sm' ? 'px-3 h-7 text-xs' : 'px-4 h-8 text-sm',
              active && 'font-semibold',
            )}
          >
            {seg.icon && <span className="w-3.5 h-3.5">{seg.icon}</span>}
            {seg.label}
          </button>
        )
      })}
    </div>
  )
}

export default SegmentedControl
