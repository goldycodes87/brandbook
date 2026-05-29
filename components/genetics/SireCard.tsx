'use client'

import { Check } from 'lucide-react'
import Badge from '@/components/ui/Badge'

export interface SireLibraryRecord {
  id: string
  bull_name: string
  bull_type: string
  breed: string | null
  naab_code: string | null
  stud: string | null
  birth_year: number | null
  is_active: boolean
  epd_bw: number | null
  epd_ww: number | null
  epd_yw: number | null
  epd_milk: number | null
  epd_dollar_b: number | null
  epd_dollar_w: number | null
  use_count: number
}

const TYPE_LABELS: Record<string, string> = {
  owned:   'OWNED',
  leased:  'LEASED',
  ai_sire: 'AI SIRE',
}

function epdColor(key: string, value: number | null): string {
  if (value == null) return 'var(--text-muted)'
  const k = key.toLowerCase()
  const isDollar =
    k.includes('dollar_w') || k.includes('dollar_f') ||
    k.includes('dollar_g') || k.includes('dollar_b') ||
    k === '$w' || k === '$f' || k === '$g' || k === '$b'
  if (isDollar) {
    if (value > 0) return 'var(--success-fg)'
    if (value < 0) return 'var(--danger-fg)'
    return 'var(--text-muted)'
  }
  return 'var(--text)'
}

interface EpdPillProps {
  label: string
  value: number | null
  epdKey: string
}

function EpdPill({ label, value, epdKey }: EpdPillProps) {
  return (
    <div
      className="flex flex-col items-center px-2 py-1 rounded"
      style={{
        backgroundColor: 'var(--surface-2)',
        border: '1px solid var(--border)',
        minWidth: 44,
      }}
    >
      <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span className="text-xs font-mono font-semibold" style={{ color: epdColor(epdKey, value) }}>
        {value != null ? (value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1)) : '—'}
      </span>
    </div>
  )
}

interface SireCardProps {
  sire: SireLibraryRecord
  onClick?: () => void
  isComparing?: boolean
  onToggleCompare?: (id: string) => void
}

export function SireCard({ sire, onClick, isComparing, onToggleCompare }: SireCardProps) {
  const compareMode = !!onToggleCompare

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-lg overflow-hidden transition-all${compareMode ? ' relative' : ''}`}
      style={{
        background: 'var(--surface-1)',
        border: `1px solid ${isComparing ? 'var(--accent)' : 'var(--border)'}`,
        opacity: sire.is_active ? 1 : 0.55,
      }}
    >
      {/* Compare checkbox */}
      {compareMode && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onToggleCompare!(sire.id) }}
          className="absolute top-2 left-2 w-6 h-6 rounded flex items-center justify-center transition-colors z-10"
          style={{
            background: isComparing ? 'var(--accent)' : 'var(--surface-3)',
            border: isComparing ? '1px solid var(--accent)' : '1px solid var(--border)',
          }}
        >
          {isComparing && <Check size={12} color="white" />}
        </button>
      )}

      {/* Header */}
      <div className={`pt-3 pb-2 flex items-start justify-between gap-2${compareMode ? ' pl-10 pr-4' : ' px-4'}`}>
        <div className="min-w-0">
          <div className="font-semibold truncate" style={{ color: 'var(--text)' }}>{sire.bull_name}</div>
          <div className="type-helper mt-0.5 flex items-center gap-1.5 flex-wrap">
            {sire.naab_code  && <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{sire.naab_code}</span>}
            {sire.breed      && <span style={{ color: 'var(--text-muted)' }}>{sire.breed}</span>}
            {sire.stud       && <span style={{ color: 'var(--text-muted)' }}>· {sire.stud}</span>}
            {sire.birth_year && <span style={{ color: 'var(--text-muted)' }}>· {sire.birth_year}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <Badge variant={sire.bull_type === 'owned' ? 'success' : sire.bull_type === 'leased' ? 'warning' : 'neutral'}>
            {TYPE_LABELS[sire.bull_type] ?? sire.bull_type}
          </Badge>
          {!sire.is_active && <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>INACTIVE</span>}
        </div>
      </div>

      {/* EPD strip */}
      <div className="px-4 pb-3 flex items-center gap-1.5 flex-wrap">
        <EpdPill label="BW"   value={sire.epd_bw}        epdKey="epd_bw" />
        <EpdPill label="WW"   value={sire.epd_ww}        epdKey="epd_ww" />
        <EpdPill label="YW"   value={sire.epd_yw}        epdKey="epd_yw" />
        <EpdPill label="Milk" value={sire.epd_milk}      epdKey="epd_milk" />
        <EpdPill label="$B"   value={sire.epd_dollar_b}  epdKey="epd_dollar_b" />
        <EpdPill label="$W"   value={sire.epd_dollar_w}  epdKey="epd_dollar_w" />
        {sire.use_count > 0 && (
          <span className="ml-auto type-helper" style={{ color: 'var(--text-muted)' }}>
            {sire.use_count} use{sire.use_count !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </button>
  )
}
