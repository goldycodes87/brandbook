'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Panel, PanelSection } from '@/components/ui/Panel'
import { Chip, StatusChip } from '@/components/ui/Chip'
import { EarTagDot } from '@/components/ui/EarTagDot'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { ANIMAL_STATUS_CHIP, SEX_CHIP, getSexValue } from '@/components/ui/tokens'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BullCalf {
  id: string
  tag_number: string
  name: string | null
  sex: string | null
  calf_sex: string | null
  status: string | null
  ear_tag_color: string | null
  dob: string | null
  birth_weight_lbs: number | null
  weaning_weight_lbs: number | null
  dam_id: string | null
}

interface DamRef {
  id: string
  tag_number: string
  name: string | null
  ear_tag_color: string | null
}

interface YearGroup {
  year: string
  calves: BullCalf[]
  heifer_count: number
  bull_count: number
  avg_bw: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function avgOf(nums: number[]): number | null {
  if (!nums.length) return null
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BullPerformanceSection({
  animalId,
  sireLibraryId,
}: {
  animalId: string
  sireLibraryId?: string | null
}) {
  const [calves, setCalves]     = useState<BullCalf[]>([])
  const [dams, setDams]         = useState<Record<string, DamRef>>({})
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/animals?sire_id=${animalId}&limit=100`)
        const json = await res.json()
        const fetched: BullCalf[] = json.data ?? []
        if (cancelled) return
        setCalves(fetched)

        // Batch-fetch dam details for the "Dam" field in calf cards
        const damIds = [...new Set(fetched.map(c => c.dam_id).filter(Boolean))] as string[]
        if (damIds.length > 0) {
          const damRes = await fetch(`/api/animals?ids=${damIds.join(',')}&limit=${damIds.length}`)
          const damJson = await damRes.json()
          const map: Record<string, DamRef> = {}
          for (const d of damJson.data ?? []) map[d.id] = d
          if (!cancelled) setDams(map)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [animalId])

  // ── Aggregate stats ─────────────────────────────────────────────────────────
  const totalCalves  = calves.length
  const heiferCount  = calves.filter(c => c.calf_sex === 'heifer_calf').length
  const bullCount    = calves.filter(c => c.calf_sex === 'bull_calf').length
  const bwNums       = calves.map(c => c.birth_weight_lbs).filter((w): w is number => w != null)
  const wwNums       = calves.map(c => c.weaning_weight_lbs).filter((w): w is number => w != null)
  const avgBw        = avgOf(bwNums)
  const avgWw        = avgOf(wwNums)

  // ── Group by year of DOB ────────────────────────────────────────────────────
  const yearGroups: YearGroup[] = useMemo(() => {
    const map = new Map<string, BullCalf[]>()
    for (const c of calves) {
      const yr = c.dob?.slice(0, 4) ?? 'Unknown'
      if (!map.has(yr)) map.set(yr, [])
      map.get(yr)!.push(c)
    }
    return [...map.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([year, yrCalves]) => ({
        year,
        calves: yrCalves,
        heifer_count: yrCalves.filter(c => c.calf_sex === 'heifer_calf').length,
        bull_count:   yrCalves.filter(c => c.calf_sex === 'bull_calf').length,
        avg_bw:       avgOf(yrCalves.map(c => c.birth_weight_lbs).filter((w): w is number => w != null)),
      }))
  }, [calves])

  const toggleYear = (yr: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(yr) ? next.delete(yr) : next.add(yr)
      return next
    })

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Panel title="SIRE PERFORMANCE">
        <PanelSection>
          <p className="type-helper" style={{ color: 'var(--text-muted)' }}>Loading…</p>
        </PanelSection>
      </Panel>
    )
  }

  // ── Empty ───────────────────────────────────────────────────────────────────
  if (totalCalves === 0) {
    return (
      <Panel title="SIRE PERFORMANCE">
        <PanelSection>
          <ContextBanner tone="neutral">
            No calves recorded for this bull yet. Log breeding events to start tracking sire performance.
          </ContextBanner>
        </PanelSection>
      </Panel>
    )
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <Panel title="SIRE PERFORMANCE">

      {/* Stats row */}
      <PanelSection>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'TOTAL CALVES', value: String(totalCalves) },
            { label: 'HEIFER / BULL', value: `${heiferCount} / ${bullCount}` },
            { label: 'AVG BW',        value: avgBw != null ? `${avgBw} lbs` : '—' },
            { label: 'AVG WW',        value: avgWw != null ? `${avgWw} lbs` : '—' },
          ].map(s => (
            <div
              key={s.label}
              className="rounded-[var(--radius-md)] p-3 text-center"
              style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              <p className="type-section-label mb-1" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{s.label}</p>
              <p className="type-data-lg font-bold" style={{ color: 'var(--text)' }}>{s.value}</p>
            </div>
          ))}
        </div>
      </PanelSection>

      {/* By-year breakdown */}
      {yearGroups.map(group => (
        <div key={group.year} style={{ borderTop: '1px solid var(--border)' }}>

          {/* Year header row — collapses calf cards */}
          <button
            type="button"
            className="w-full flex items-center gap-3 px-5 py-3 text-left"
            style={{ backgroundColor: 'var(--surface-2)' }}
            onClick={() => toggleYear(group.year)}
          >
            {expanded.has(group.year)
              ? <ChevronDown  size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              : <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
            <span className="type-label font-semibold" style={{ color: 'var(--text)' }}>{group.year}</span>
            <span className="type-helper" style={{ color: 'var(--text-muted)' }}>
              {group.calves.length} calf{group.calves.length !== 1 ? 'ves' : ''}
            </span>
            <span className="type-helper" style={{ color: 'var(--text-muted)' }}>
              {group.heifer_count}H&nbsp;/&nbsp;{group.bull_count}B
            </span>
            {group.avg_bw != null && (
              <span className="type-helper ml-auto" style={{ color: 'var(--text-muted)' }}>
                BW avg:&nbsp;{group.avg_bw}&nbsp;lbs
              </span>
            )}
          </button>

          {/* Calf cards — 2-col on tablet */}
          {expanded.has(group.year) && (
            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3"
              style={{ backgroundColor: 'var(--surface-1)' }}
            >
              {group.calves.map(calf => {
                const dam    = calf.dam_id ? dams[calf.dam_id] : null
                const sexVal = getSexValue(calf.sex ?? '', calf.calf_sex ?? '')
                return (
                  <Link
                    key={calf.id}
                    href={`/animals/${calf.id}`}
                    className="flex items-start gap-3 rounded-[var(--radius-md)] p-3"
                    style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', textDecoration: 'none' }}
                  >
                    <EarTagDot color={calf.ear_tag_color} size="sm" />
                    <div className="flex-1 min-w-0">
                      {/* Tag + sex + status */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="type-data-sm font-semibold" style={{ color: 'var(--text)' }}>
                          #{calf.tag_number}
                        </span>
                        {calf.name && (
                          <span className="type-helper truncate" style={{ color: 'var(--text-muted)' }}>{calf.name}</span>
                        )}
                        {sexVal && (
                          <StatusChip map={SEX_CHIP} value={sexVal} size="sm" />
                        )}
                        {calf.status && (
                          <StatusChip map={ANIMAL_STATUS_CHIP} value={calf.status} size="sm" />
                        )}
                      </div>
                      {/* DOB + weights + dam */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {calf.dob && (
                          <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{fmtDate(calf.dob)}</span>
                        )}
                        {calf.birth_weight_lbs != null && (
                          <span className="type-helper" style={{ color: 'var(--text-muted)' }}>BW {calf.birth_weight_lbs} lbs</span>
                        )}
                        {calf.weaning_weight_lbs != null && (
                          <span className="type-helper" style={{ color: 'var(--text-muted)' }}>WW {calf.weaning_weight_lbs} lbs</span>
                        )}
                        {dam && (
                          <span className="type-helper" style={{ color: 'var(--text-muted)' }}>
                            Dam:{' '}
                            <span style={{ color: 'var(--accent)' }}>#{dam.tag_number}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      ))}

      {/* Footer link to genetics performance page */}
      {sireLibraryId && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 20px' }}>
          <Link
            href={`/genetics?tab=performance&sire=${sireLibraryId}`}
            className="type-label"
            style={{ color: 'var(--accent)', textDecoration: 'none' }}
          >
            VIEW ALL IN GENETICS →
          </Link>
        </div>
      )}
    </Panel>
  )
}
