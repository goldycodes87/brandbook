'use client'

import { useState, useEffect } from 'react'
import { X, Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { apiGet } from '@/lib/fetch'

// ─── Types ─────────────────────────────────────────────────────────────────

interface FullSire {
  id: string
  bull_name: string
  breed: string | null
  naab_code: string | null
  stud: string | null
  birth_year: number | null
  bull_type: string | null
  epd_bw: number | null
  epd_ww: number | null
  epd_yw: number | null
  epd_milk: number | null
  epd_tm: number | null
  epd_cw: number | null
  epd_rea: number | null
  epd_fat: number | null
  epd_marbling: number | null
  epd_dollar_w: number | null
  epd_dollar_f: number | null
  epd_dollar_g: number | null
  epd_dollar_b: number | null
}

// ─── Table row definitions ──────────────────────────────────────────────────

type InfoRow    = { type: 'info';    label: string; key: keyof FullSire }
type SectionRow = { type: 'section'; label: string }
type EpdRow     = { type: 'epd';     label: string; key: keyof FullSire; decimals: number; lowerIsBetter?: boolean }
type TableRow   = InfoRow | SectionRow | EpdRow

const TABLE_ROWS: TableRow[] = [
  { type: 'info',    label: 'Bull Name',   key: 'bull_name' },
  { type: 'info',    label: 'Breed',       key: 'breed' },
  { type: 'info',    label: 'NAAB Code',   key: 'naab_code' },
  { type: 'info',    label: 'Stud',        key: 'stud' },
  { type: 'info',    label: 'Birth Year',  key: 'birth_year' },
  { type: 'section', label: 'BIRTH WEIGHT' },
  { type: 'epd',     label: 'BW EPD',      key: 'epd_bw',        decimals: 1, lowerIsBetter: true },
  { type: 'section', label: 'GROWTH' },
  { type: 'epd',     label: 'WW EPD',      key: 'epd_ww',        decimals: 1 },
  { type: 'epd',     label: 'YW EPD',      key: 'epd_yw',        decimals: 1 },
  { type: 'section', label: 'MATERNAL' },
  { type: 'epd',     label: 'Milk',        key: 'epd_milk',      decimals: 1 },
  { type: 'epd',     label: 'TM',          key: 'epd_tm',        decimals: 1 },
  { type: 'section', label: 'CARCASS' },
  { type: 'epd',     label: 'CW',          key: 'epd_cw',        decimals: 1 },
  { type: 'epd',     label: 'REA',         key: 'epd_rea',       decimals: 2 },
  { type: 'epd',     label: 'Marbling',    key: 'epd_marbling',  decimals: 2 },
  { type: 'epd',     label: 'Fat',         key: 'epd_fat',       decimals: 3, lowerIsBetter: true },
  { type: 'section', label: 'DOLLAR INDEXES' },
  { type: 'epd',     label: '$W',          key: 'epd_dollar_w',  decimals: 0 },
  { type: 'epd',     label: '$F',          key: 'epd_dollar_f',  decimals: 0 },
  { type: 'epd',     label: '$G',          key: 'epd_dollar_g',  decimals: 0 },
  { type: 'epd',     label: '$B',          key: 'epd_dollar_b',  decimals: 0 },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function epdColor(key: string, value: number | null): string {
  if (value == null) return 'var(--text-muted)'
  const k = key.toLowerCase()
  const isDollar =
    k.includes('dollar_w') || k.includes('dollar_f') ||
    k.includes('dollar_g') || k.includes('dollar_b')
  if (isDollar) {
    if (value > 0) return 'var(--success-fg)'
    if (value < 0) return 'var(--danger-fg)'
    return 'var(--text-muted)'
  }
  return 'var(--text)'
}

function bestIndex(values: (number | null)[], lowerIsBetter: boolean): number {
  const nonNull = values
    .map((v, i) => (v != null ? { v, i } : null))
    .filter((x): x is { v: number; i: number } => x != null)
  if (nonNull.length < 2) return -1
  const best = lowerIsBetter
    ? nonNull.reduce((a, b) => (b.v < a.v ? b : a))
    : nonNull.reduce((a, b) => (b.v > a.v ? b : a))
  return best.i
}

function formatEpd(key: string, value: number | null, decimals: number): string {
  if (value == null) return '—'
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toFixed(decimals)}`
}

// ─── Component ──────────────────────────────────────────────────────────────

interface SireCompareModalProps {
  sireIds: string[]
  onClose: () => void
}

export function SireCompareModal({ sireIds, onClose }: SireCompareModalProps) {
  const [sires, setSires] = useState<FullSire[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all(sireIds.map(id => apiGet(`/api/genetics/sires/${id}`).then(r => r.json())))
      .then(results => {
        setSires(results.filter((r): r is FullSire => r && !r.error))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [sireIds]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body > *:not(.sire-compare-print) { display: none !important; }
          .sire-compare-print { position: static !important; background: white !important; }
          .sire-compare-no-print { display: none !important; }
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="sire-compare-print fixed inset-0 z-[60] flex items-center justify-center p-0 md:p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <div
          className="relative w-full h-full md:h-auto md:rounded-[var(--radius-xl)] flex flex-col overflow-hidden"
          style={{
            backgroundColor: 'var(--surface-1)',
            border: '1px solid var(--border)',
            maxWidth: '90vw',
            maxHeight: '90vh',
          }}
        >
          {/* Header */}
          <div
            className="sire-compare-no-print flex items-center justify-between px-5 py-4 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <span className="type-panel-title">BULL COMPARISON</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded type-helper transition-colors"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                <Printer size={14} />
                Print / Export PDF
              </button>
              <button type="button" onClick={onClose} style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <p className="type-body" style={{ color: 'var(--text-muted)' }}>Loading…</p>
              </div>
            ) : (
              <table className="w-full text-sm border-collapse" style={{ minWidth: `${140 + sires.length * 130}px` }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-2)', borderBottom: '2px solid var(--border)' }}>
                    <th
                      className="sticky left-0 px-4 py-3 text-left type-section-label"
                      style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)', minWidth: 140, zIndex: 1 }}
                    >
                      EPD
                    </th>
                    {sires.map(s => (
                      <th
                        key={s.id}
                        className="px-4 py-3 text-center"
                        style={{ color: 'var(--text)', minWidth: 130 }}
                      >
                        <div className="font-semibold text-sm">{s.bull_name}</div>
                        {s.naab_code && (
                          <div className="type-helper font-normal mt-0.5" style={{ color: 'var(--accent)' }}>
                            {s.naab_code}
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TABLE_ROWS.map((row, rowIdx) => {
                    if (row.type === 'section') {
                      return (
                        <tr key={rowIdx} style={{ backgroundColor: 'var(--surface-2)' }}>
                          <td
                            colSpan={sires.length + 1}
                            className="sticky left-0 px-4 py-1.5 type-section-label"
                            style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)', zIndex: 1 }}
                          >
                            {row.label}
                          </td>
                        </tr>
                      )
                    }

                    if (row.type === 'info') {
                      return (
                        <tr key={rowIdx} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td
                            className="sticky left-0 px-4 py-2.5 type-helper"
                            style={{ backgroundColor: 'var(--surface-1)', color: 'var(--text-muted)', zIndex: 1 }}
                          >
                            {row.label}
                          </td>
                          {sires.map(s => (
                            <td key={s.id} className="px-4 py-2.5 text-center text-sm" style={{ color: 'var(--text)' }}>
                              {String(s[row.key] ?? '—')}
                            </td>
                          ))}
                        </tr>
                      )
                    }

                    // EPD row
                    const values = sires.map(s => s[row.key] as number | null)
                    const best   = bestIndex(values, row.lowerIsBetter ?? false)

                    return (
                      <tr key={rowIdx} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td
                          className="sticky left-0 px-4 py-2.5 type-helper"
                          style={{ backgroundColor: 'var(--surface-1)', color: 'var(--text-muted)', zIndex: 1 }}
                        >
                          {row.label}
                        </td>
                        {sires.map((s, ci) => {
                          const val       = s[row.key] as number | null
                          const isBest    = ci === best
                          const color     = epdColor(row.key, val)
                          return (
                            <td
                              key={s.id}
                              className="px-4 py-2.5 text-center font-mono text-sm font-semibold"
                              style={{
                                color: isBest ? 'var(--gold-fg)' : color,
                                backgroundColor: isBest ? 'var(--gold-bg)' : undefined,
                                fontWeight: isBest ? 700 : undefined,
                                outline: isBest ? '1px solid var(--gold-border)' : undefined,
                              }}
                            >
                              {formatEpd(row.key, val, row.decimals)}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
                {/* Footer: USE THIS BULL */}
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)', backgroundColor: 'var(--surface-2)' }}>
                    <td className="sticky left-0 px-4 py-3" style={{ backgroundColor: 'var(--surface-2)', zIndex: 1 }} />
                    {sires.map(s => (
                      <td key={s.id} className="px-4 py-3 text-center">
                        <a
                          href={`/reproduction?sire_id=${s.id}`}
                          className="inline-block px-3 py-1.5 rounded type-helper font-semibold transition-colors"
                          style={{
                            backgroundColor: 'var(--accent)',
                            color: 'white',
                            textDecoration: 'none',
                          }}
                        >
                          USE THIS BULL
                        </a>
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
