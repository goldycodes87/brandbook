'use client'

import Link from 'next/link'
import { useState } from 'react'
import { StatusChip, Chip } from '@/components/ui/Chip'
import { EarTagDot } from '@/components/ui/EarTagDot'
import { SEX_CHIP } from '@/components/ui/tokens'
import type { ReproEventShape, CalfRecord } from './PregnancyCard'

interface SireLibraryEntry {
  id: string
  bull_name: string
  breed?: string | null
  naab_code?: string | null
  stud?: string | null
  bull_type: string
}

interface WeightRecord {
  id: string
  weight_lbs: number
  weighed_at: string
  source: string
}

interface CowCalfCardProps {
  calfEvent: ReproEventShape
  calf: CalfRecord | null
  bredEvent?: ReproEventShape | null
  pregCheckEvents?: ReproEventShape[]
  weaningEvent?: ReproEventShape | null
  sireLibraryEntry?: SireLibraryEntry | null
  calfWeights?: WeightRecord[]
  onDispose?: (calfId: string) => void
}

const EASE_LABELS: Record<number, string> = {
  1: 'Unassisted',
  2: 'Minor Assist',
  3: 'Major Assist',
  4: 'C-Section',
  5: 'Abnormal',
}

const DISPOSITION_CHIP: Record<string, { tone: 'success' | 'neutral' | 'info' | 'gold' | 'danger' | 'accent'; label: string }> = {
  retained_replacement: { tone: 'success',  label: 'RETAINED BREEDER'  },
  retained_feeder:      { tone: 'neutral',  label: 'RETAINED FEEDER'   },
  sold_auction:         { tone: 'info',     label: 'SOLD — AUCTION'    },
  sold_private:         { tone: 'info',     label: 'SOLD — PRIVATE'    },
  sold_beef:            { tone: 'gold',     label: 'BEEF PRODUCTION'   },
  deceased:             { tone: 'danger',   label: 'DECEASED'          },
  transferred:          { tone: 'accent',   label: 'TRANSFERRED'       },
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function fmtDateShort(d: string | null | undefined): string {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: '2-digit',
  })
}

export function CowCalfCard({
  calfEvent,
  calf,
  bredEvent,
  pregCheckEvents = [],
  weaningEvent,
  sireLibraryEntry,
  calfWeights = [],
  onDispose,
}: CowCalfCardProps) {
  const [breedingExpanded, setBreedingExpanded] = useState(false)

  // ── Derived values ──────────────────────────────────────────────────────────
  const calfFromEvent  = calfEvent.calf
  const calfSex        = calfFromEvent?.calf_sex ?? calf?.calf_sex ?? null
  const calfTag        = calfFromEvent?.tag_number ?? calf?.tag_number ?? '?'
  const calfName       = calfFromEvent?.name ?? calf?.name ?? null
  const calfDob        = calfFromEvent?.dob ?? calfEvent.event_date ?? null
  const earTagColor    = calfFromEvent?.ear_tag_color ?? calf?.ear_tag_color ?? null
  // Prefer the CalfRecord prop (direct from calves list) over the event JOIN result
  const calfId         = calf?.id ?? calfFromEvent?.id ?? null

  // Birth weight: prefer event calf record, then CalfRecord, then weight log
  const birthWeightFromEvent = calfFromEvent?.birth_weight_lbs ?? null
  const birthWeightFromRecord = calf?.birth_weight_lbs ?? null
  const birthWeightFromLog = calfWeights.find(w => w.source === 'birth')?.weight_lbs ?? null
  const birthWeight    = birthWeightFromEvent ?? birthWeightFromRecord ?? birthWeightFromLog ?? null
  const birthWeightEst = birthWeight == null ? false : (birthWeightFromEvent == null && birthWeightFromRecord == null && birthWeightFromLog != null)

  const easeScore      = calfEvent.calving_ease_score ?? null

  const sireLib        = sireLibraryEntry ?? calfEvent.sire_library ?? bredEvent?.sire_library ?? null
  const sireAnimal     = calfEvent.sire ?? bredEvent?.sire ?? null
  const sireNameText   = calfEvent.sire_name_text ?? bredEvent?.sire_name_text ?? null

  const isWeaned       = !!weaningEvent || !!calf?.weaning_date
  const weanWeight     = weaningEvent?.weaning_weight_lbs ?? calf?.weaning_weight_lbs ?? null
  const weanDate       = weaningEvent?.event_date ?? weaningEvent?.weaning_date ?? calf?.weaning_date ?? null

  // Current sex (graduated from calf)
  const currentSex = calf?.sex ?? null
  const graduatedSexes = ['heifer', 'bull', 'steer', 'cow']
  const showNowChip = currentSex && graduatedSexes.includes(currentSex)

  const nowChipTone: 'gold' | 'accent' | 'neutral' | 'success' =
    currentSex === 'heifer' ? 'gold'    :
    currentSex === 'bull'   ? 'accent'  :
    currentSex === 'steer'  ? 'neutral' :
    'success'

  // Breeding details
  const method        = bredEvent?.breed_method ?? bredEvent?.conception_method ?? null
  const aiTechnician  = bredEvent?.ai_technician ?? null
  const expectedCalve = bredEvent?.expected_calving_date ?? calfEvent.expected_calving_date ?? null
  const mostRecentPregCheck = pregCheckEvents.length > 0
    ? [...pregCheckEvents].sort((a, b) => b.event_date.localeCompare(a.event_date))[0]
    : null

  // Disposition
  const disposition = calf?.status === 'sold' || calf?.status === 'deceased'
    ? calf?.status
    : (calf as (CalfRecord & { disposition?: string | null }) | null)?.disposition ?? null

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="rounded-[var(--radius-lg)] p-4 flex flex-col gap-3"
      style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
    >
      {/* ── ROW 1: Header ── */}
      <div className="flex items-start justify-between gap-2">
        {/* Left */}
        <div className="flex items-center gap-2 flex-wrap">
          {calfSex && <StatusChip map={SEX_CHIP} value={calfSex} size="sm" />}
          <EarTagDot color={earTagColor} size="md" />
          <span
            className="font-mono font-bold text-xl"
            style={{ color: 'var(--accent)' }}
          >
            #{calfTag}
          </span>
          {calfName && (
            <span className="type-helper" style={{ color: 'var(--text-muted)' }}>
              {calfName}
            </span>
          )}
          {showNowChip && currentSex && (
            <Chip tone={nowChipTone} size="sm">
              NOW: {currentSex.toUpperCase()}
            </Chip>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="type-helper" style={{ color: 'var(--text-muted)' }}>
            {fmtDate(calfDob)}
          </span>
          {calfId && (
            <Link
              href={`/animals/${calfId}`}
              className="type-helper font-semibold min-h-[44px] flex items-center"
              style={{ color: 'var(--accent)' }}
              onClick={e => e.stopPropagation()}
            >
              VIEW CALF →
            </Link>
          )}
        </div>
      </div>

      {/* ── ROW 2: Stats grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Birth weight */}
        <div
          className="rounded-lg p-2.5"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
        >
          <div className="type-section-label" style={{ color: 'var(--text-muted)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            BIRTH WEIGHT
          </div>
          <div className="type-data-sm font-semibold mt-0.5">
            {birthWeight != null
              ? `${birthWeight} lbs${birthWeightEst ? ' (est)' : ''}`
              : <span style={{ color: 'var(--text-muted)' }}>—</span>
            }
          </div>
        </div>

        {/* Sire */}
        <div
          className="rounded-lg p-2.5"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
        >
          <div className="type-section-label" style={{ color: 'var(--text-muted)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            SIRE
          </div>
          <div className="type-data-sm font-semibold mt-0.5 flex flex-wrap items-center gap-1">
            {sireLib ? (
              <>
                <span style={{ color: 'var(--accent)', fontSize: '11px' }}>
                  {sireLib.bull_name}
                </span>
                {sireLib.breed && (
                  <Chip tone="neutral" size="sm">{sireLib.breed}</Chip>
                )}
                <span
                  className="type-helper px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-border)', fontSize: '9px' }}
                >
                  AI SIRE
                </span>
                {sireLib.naab_code && (
                  <span
                    className="type-helper"
                    style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)', fontSize: '10px' }}
                  >
                    {sireLib.naab_code}
                  </span>
                )}
              </>
            ) : sireAnimal ? (
              <Link
                href={`/animals/${sireAnimal.id}`}
                className="hover:underline"
                style={{ color: 'var(--accent)', fontSize: '11px' }}
              >
                #{sireAnimal.tag_number}{sireAnimal.name ? ` — ${sireAnimal.name}` : ''}
              </Link>
            ) : sireNameText ? (
              <span style={{ color: 'var(--text-muted)' }}>{sireNameText}</span>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>Unknown</span>
            )}
          </div>
        </div>

        {/* Wean weight */}
        <div
          className="rounded-lg p-2.5"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
        >
          <div className="type-section-label" style={{ color: 'var(--text-muted)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            WEAN WEIGHT
          </div>
          <div className="type-data-sm font-semibold mt-0.5">
            {!isWeaned ? (
              <span style={{ color: 'var(--text-muted)' }}>Not yet weaned</span>
            ) : weanWeight != null ? (
              <>
                <span>{weanWeight} lbs</span>
                {weanDate && (
                  <div className="type-helper" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                    {fmtDate(weanDate)}
                  </div>
                )}
              </>
            ) : (
              <>
                <span style={{ color: 'var(--text)' }}>Weaned</span>
                {weanDate && (
                  <div className="type-helper" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                    {fmtDate(weanDate)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Ease score */}
        <div
          className="rounded-lg p-2.5"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
        >
          <div className="type-section-label" style={{ color: 'var(--text-muted)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            EASE SCORE
          </div>
          <div className="type-data-sm font-semibold mt-0.5">
            {easeScore != null
              ? `${easeScore} — ${EASE_LABELS[easeScore] ?? String(easeScore)}`
              : <span style={{ color: 'var(--text-muted)' }}>—</span>
            }
          </div>
        </div>
      </div>

      {/* ── ROW 3: Timeline strip ── */}
      <div className="flex items-center gap-4">
        {/* Bred */}
        {bredEvent && (
          <>
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: 'var(--info-fg)' }}
              />
              <span className="type-helper font-semibold text-center" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                BRED
              </span>
              <span className="type-helper text-center" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                {fmtDateShort(bredEvent.event_date)}
              </span>
            </div>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </>
        )}

        {/* Calved (always) */}
        <div className="flex flex-col items-center gap-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: 'var(--success-fg)' }}
          />
          <span className="type-helper font-semibold text-center" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
            CALVED
          </span>
          <span className="type-helper text-center" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
            {fmtDateShort(calfDob)}
          </span>
        </div>

        {/* Wean dot — filled if isWeaned, gray placeholder if not */}
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        <div className="flex flex-col items-center gap-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: isWeaned ? '#ca8a04' : 'var(--border)' }}
          />
          <span className="type-helper font-semibold text-center" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
            WEAN
          </span>
          <span className="type-helper text-center" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
            {weanDate ? fmtDateShort(weanDate) : '—'}
          </span>
        </div>
      </div>

      {/* ── ROW 4: Disposition banner ── */}
      {(() => {
        const dispKey = (calf as (CalfRecord & { disposition?: string | null }) | null)?.disposition ?? null
        const chip = dispKey ? DISPOSITION_CHIP[dispKey] : null
        if (chip) {
          return (
            <div className="flex items-center gap-2">
              <Chip tone={chip.tone} size="sm">{chip.label}</Chip>
            </div>
          )
        }
        if (!dispKey && isWeaned && onDispose && calfId) {
          return (
            <button
              type="button"
              className="type-helper font-semibold text-left"
              style={{ color: 'var(--accent)' }}
              onClick={() => onDispose(calfId)}
            >
              RECORD DISPOSITION →
            </button>
          )
        }
        return null
      })()}

      {/* ── ROW 5: Breeding details (collapsible) ── */}
      {bredEvent && (
        <div>
          <button
            type="button"
            className="type-helper font-semibold"
            style={{ color: 'var(--text-secondary)' }}
            onClick={() => setBreedingExpanded(v => !v)}
          >
            {breedingExpanded ? '▾' : '▸'} BREEDING DETAILS
          </button>

          {breedingExpanded && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <div className="type-section-label" style={{ color: 'var(--text-muted)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  BRED DATE
                </div>
                <div className="type-data-sm mt-0.5">{fmtDate(bredEvent.event_date)}</div>
              </div>

              {method && (
                <div>
                  <div className="type-section-label" style={{ color: 'var(--text-muted)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    METHOD
                  </div>
                  <div className="type-data-sm mt-0.5">
                    {method === 'ai' ? 'Artificial Insemination' : method === 'embryo' ? 'Embryo Transfer' : method}
                  </div>
                </div>
              )}

              {aiTechnician && (
                <div>
                  <div className="type-section-label" style={{ color: 'var(--text-muted)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    AI TECHNICIAN
                  </div>
                  <div className="type-data-sm mt-0.5">{aiTechnician}</div>
                </div>
              )}

              {expectedCalve && (
                <div>
                  <div className="type-section-label" style={{ color: 'var(--text-muted)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    EXPECTED CALVING
                  </div>
                  <div className="type-data-sm mt-0.5">{fmtDate(expectedCalve)}</div>
                </div>
              )}

              {mostRecentPregCheck && (
                <div>
                  <div className="type-section-label" style={{ color: 'var(--text-muted)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    PREG CHECK
                  </div>
                  <div className="type-data-sm mt-0.5 flex items-center gap-1.5 flex-wrap">
                    {mostRecentPregCheck.preg_check_result && (
                      <Chip
                        tone={
                          mostRecentPregCheck.preg_check_result === 'confirmed' ? 'success' :
                          mostRecentPregCheck.preg_check_result === 'open'      ? 'warning' : 'neutral'
                        }
                        size="sm"
                      >
                        {mostRecentPregCheck.preg_check_result.toUpperCase()}
                      </Chip>
                    )}
                    <span className="type-helper" style={{ color: 'var(--text-muted)' }}>
                      {fmtDate(mostRecentPregCheck.event_date)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
