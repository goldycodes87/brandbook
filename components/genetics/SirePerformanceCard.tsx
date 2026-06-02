'use client'

import Link from 'next/link'
import { Chip } from '@/components/ui/Chip'
import type { SirePerformance } from '@/app/api/genetics/performance/route'

const CALF_COLOR: Record<string, string> = {
  heifer_calf: 'var(--gold-fg, #B45309)',
  bull_calf:   'var(--accent)',
}

interface SirePerformanceCardProps {
  sire: SirePerformance
}

export function SirePerformanceCard({ sire }: SirePerformanceCardProps) {
  const years = Object.keys(sire.calves_by_year).sort()
  const shownCalves = sire.calves.slice(0, 8)
  const extraCalves = sire.calves.length - 8

  return (
    <div
      className="rounded-[var(--radius-lg)] p-4"
      style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            {sire.sire_type === 'library' ? (
              <Chip tone="info" size="sm">AI SIRE</Chip>
            ) : (
              <Chip tone="neutral" size="sm">HERD BULL</Chip>
            )}
            {sire.sire_breed && (
              <Chip tone="neutral" size="sm">{sire.sire_breed}</Chip>
            )}
          </div>
          <p className="type-data-sm font-semibold" style={{ color: 'var(--text)' }}>
            {sire.sire_library_id ? (
              <Link href={`/genetics/sires/${sire.sire_library_id}`} className="hover:underline" style={{ color: 'var(--accent)' }}>
                {sire.sire_name}
              </Link>
            ) : sire.sire_id ? (
              <Link href={`/animals/${sire.sire_id}`} className="hover:underline" style={{ color: 'var(--accent)' }}>
                {sire.sire_name}
              </Link>
            ) : (
              sire.sire_name
            )}
          </p>
          {sire.sire_naab && (
            <p className="type-helper" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{sire.sire_naab}</p>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[
          { label: 'COWS BRED',    value: sire.cows_bred > 0 ? sire.cows_bred : '—' },
          { label: 'CALVES BORN',  value: sire.calves_born },
          { label: 'CONCEPTION',   value: sire.conception_rate != null ? `${sire.conception_rate}%` : '—' },
          { label: 'SEX RATIO',    value: `${sire.heifer_calves}H / ${sire.bull_calves}B` },
        ].map(s => (
          <div key={s.label} className="text-center rounded-[var(--radius-md)] p-2" style={{ backgroundColor: 'var(--surface-2)' }}>
            <p className="type-chip mb-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            <p className="type-data-sm font-semibold" style={{ color: 'var(--text)' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Weight averages */}
      {(sire.avg_birth_weight != null || sire.avg_weaning_weight != null) && (
        <div className="flex gap-3 mb-3">
          {sire.avg_birth_weight != null && (
            <span className="type-helper" style={{ color: 'var(--text-muted)' }}>Avg BW: <strong style={{ color: 'var(--text)' }}>{sire.avg_birth_weight} lb</strong></span>
          )}
          {sire.avg_weaning_weight != null && (
            <span className="type-helper" style={{ color: 'var(--text-muted)' }}>Avg WW: <strong style={{ color: 'var(--text)' }}>{sire.avg_weaning_weight} lb</strong></span>
          )}
        </div>
      )}

      {/* Calf chips */}
      {shownCalves.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {shownCalves.map(c => (
            <Link key={c.id} href={`/animals/${c.id}`}>
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full type-helper transition-opacity hover:opacity-70"
                style={{
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--surface-2)',
                  color: CALF_COLOR[c.calf_sex ?? ''] ?? 'var(--text-muted)',
                }}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: CALF_COLOR[c.calf_sex ?? ''] ?? 'var(--text-muted)' }}
                />
                #{c.tag_number}
              </span>
            </Link>
          ))}
          {extraCalves > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full type-helper" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              +{extraCalves} more
            </span>
          )}
        </div>
      )}

      {/* Year pills */}
      {years.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          {years.map(yr => (
            <span key={yr} className="type-chip px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              {yr}: {sire.calves_by_year[yr]}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
