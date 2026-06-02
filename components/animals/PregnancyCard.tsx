'use client'

import Link from 'next/link'
import { StatusChip, Chip } from '@/components/ui/Chip'
import { EarTagDot } from '@/components/ui/EarTagDot'
import { SEX_CHIP } from '@/components/ui/tokens'

export interface ReproEventShape {
  id: string
  event_type: string
  event_date: string
  calf_id?: string | null
  expected_calving_date?: string | null
  calving_ease_score?: number | null
  preg_check_result?: string | null
  preg_check_method?: string | null
  conception_method?: string | null
  breed_method?: string | null
  ai_technician?: string | null
  sire_id?: string | null
  sire_library_id?: string | null
  sire_name_text?: string | null
  days_bred?: number | null
  weaning_date?: string | null
  weaning_weight_lbs?: number | null
  notes?: string | null
  sire?: { id: string; tag_number: string; name?: string | null } | null
  sire_library?: {
    id: string
    bull_name: string
    breed?: string | null
    naab_code?: string | null
    stud?: string | null
    bull_type: string
  } | null
  calf?: {
    id: string
    tag_number: string
    name?: string | null
    sex?: string | null
    calf_sex?: string | null
    dob?: string | null
    birth_weight_lbs?: number | null
    ear_tag_color?: string | null
  } | null
}

export interface CalfRecord {
  id: string
  tag_number: string
  name?: string | null
  sex?: string | null
  calf_sex?: string | null
  dob?: string | null
  ear_tag_color?: string | null
  status?: string | null
  weaning_date?: string | null
  weaning_weight_lbs?: number | null
  birth_weight_lbs?: number | null
  breeds?: { breed: string; pct: number }[] | null
  sire_library_id?: string | null
}

const EASE_LABELS: Record<number, string> = {
  1: 'Unassisted',
  2: 'Minor Assist',
  3: 'Major Assist',
  4: 'C-Section',
  5: 'Abnormal',
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

interface TimelineRowProps {
  color: string
  label: string
  date: string | null | undefined
  detail?: string
}

function TimelineRow({ color, label, date, detail }: TimelineRowProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="type-helper font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{fmtDate(date)}</span>
      {detail && <span className="type-helper" style={{ color: 'var(--text-muted)' }}>· {detail}</span>}
    </div>
  )
}

interface PregnancyCardProps {
  calfEvent: ReproEventShape
  calfRecord?: CalfRecord | null
  bredEvent?: ReproEventShape | null
  pregCheckEvents?: ReproEventShape[]
  weaningEvent?: ReproEventShape | null
}

export function PregnancyCard({
  calfEvent,
  calfRecord,
  bredEvent,
  pregCheckEvents = [],
  weaningEvent,
}: PregnancyCardProps) {
  const calf         = calfEvent.calf
  const calfId       = calf?.id
  const calfSex      = calf?.calf_sex ?? calfRecord?.calf_sex ?? null
  const calfTag      = calf?.tag_number ?? calfRecord?.tag_number ?? '?'
  const calfName     = calf?.name ?? calfRecord?.name
  const calfDob      = calf?.dob ?? calfEvent.event_date
  const earTagColor  = calf?.ear_tag_color ?? calfRecord?.ear_tag_color ?? null
  const birthWeight  = calf?.birth_weight_lbs ?? calfRecord?.birth_weight_lbs ?? null
  const easeScore    = calfEvent.calving_ease_score ?? null
  const conception   = calfEvent.conception_method ?? bredEvent?.conception_method ?? null

  const sireLib    = calfEvent.sire_library ?? bredEvent?.sire_library ?? null
  const sireAnimal = calfEvent.sire         ?? bredEvent?.sire         ?? null
  const sireName   = calfEvent.sire_name_text ?? bredEvent?.sire_name_text ?? null

  const currentSex = calfRecord?.sex ?? null
  const nowChip =
    currentSex === 'heifer' ? { label: 'NOW: HEIFER', tone: 'gold'    as const } :
    currentSex === 'bull'   ? { label: 'NOW: BULL',   tone: 'accent'  as const } :
    currentSex === 'steer'  ? { label: 'NOW: STEER',  tone: 'neutral' as const } :
    null

  return (
    <div
      className="rounded-[var(--radius-lg)] p-4 flex flex-col gap-3"
      style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {calfSex && <StatusChip map={SEX_CHIP} value={calfSex} size="sm" />}
          <div className="flex items-center gap-1.5">
            <EarTagDot color={earTagColor} size="md" />
            <span
              className="type-data-sm font-semibold"
              style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono, monospace)' }}
            >
              #{calfTag}
            </span>
          </div>
          {calfName && (
            <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{calfName}</span>
          )}
          {nowChip && <Chip tone={nowChip.tone} size="sm">{nowChip.label}</Chip>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{fmtDate(calfDob)}</span>
          {calfId && (
            <Link
              href={`/animals/${calfId}`}
              className="type-helper font-semibold"
              style={{ color: 'var(--accent)' }}
            >
              VIEW CALF →
            </Link>
          )}
        </div>
      </div>

      {/* Birth info row */}
      {(birthWeight != null || easeScore != null || conception) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {birthWeight != null && (
            <span className="type-data-sm" style={{ color: 'var(--text-secondary)' }}>
              {birthWeight} lbs
            </span>
          )}
          {easeScore != null && (
            <span className="type-data-sm" style={{ color: 'var(--text-secondary)' }}>
              Ease: {easeScore} — {EASE_LABELS[easeScore] ?? String(easeScore)}
            </span>
          )}
          {conception && (
            <Chip tone="neutral" size="sm">
              {conception === 'ai' ? 'AI' : conception === 'embryo' ? 'EMBRYO' : 'NATURAL'}
            </Chip>
          )}
        </div>
      )}

      {/* Sire row */}
      {(sireLib || sireAnimal || sireName) && (
        <div className="flex items-start gap-2">
          <span className="type-helper shrink-0" style={{ color: 'var(--text-muted)' }}>SIRE</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {sireLib ? (
              <>
                <Link
                  href={`/genetics/sires/${sireLib.id}`}
                  className="type-data-sm hover:underline"
                  style={{ color: 'var(--accent)' }}
                >
                  {sireLib.bull_name}
                </Link>
                {sireLib.breed && <Chip tone="neutral" size="sm">{sireLib.breed}</Chip>}
                <span
                  className="type-helper px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent)', fontSize: '10px' }}
                >
                  AI SIRE
                </span>
                {sireLib.naab_code && (
                  <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{sireLib.naab_code}</span>
                )}
              </>
            ) : sireAnimal ? (
              <Link
                href={`/animals/${sireAnimal.id}`}
                className="type-data-sm hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                #{sireAnimal.tag_number}{sireAnimal.name ? ` — ${sireAnimal.name}` : ''}
              </Link>
            ) : (
              <span className="type-data-sm" style={{ color: 'var(--text-muted)' }}>{sireName}</span>
            )}
          </div>
        </div>
      )}

      {/* Mini timeline */}
      <div className="flex flex-col gap-1.5 pl-1">
        {bredEvent && (
          <TimelineRow
            color="var(--info-fg)"
            label="BRED"
            date={bredEvent.event_date}
            detail={[
              bredEvent.breed_method === 'ai' || bredEvent.conception_method === 'ai' ? 'AI' : null,
              bredEvent.ai_technician ? `Tech: ${bredEvent.ai_technician}` : null,
            ].filter(Boolean).join(' · ') || undefined}
          />
        )}
        {pregCheckEvents.map(pc => (
          <TimelineRow
            key={pc.id}
            color="#9333ea"
            label="PREG CHECK"
            date={pc.event_date}
            detail={pc.preg_check_result?.toUpperCase()}
          />
        ))}
        <TimelineRow
          color="var(--success-fg)"
          label="CALVED"
          date={calfDob}
        />
        {weaningEvent && (
          <TimelineRow
            color="#ca8a04"
            label="WEANED"
            date={weaningEvent.weaning_date ?? weaningEvent.event_date}
            detail={
              weaningEvent.weaning_weight_lbs != null
                ? `${weaningEvent.weaning_weight_lbs} lbs`
                : 'weight not recorded'
            }
          />
        )}
      </div>
    </div>
  )
}

// ─── Open Pregnancy Card ──────────────────────────────────────────────────────

interface OpenPregnancyCardProps {
  bredEvent: ReproEventShape
  pregCheckEvents?: ReproEventShape[]
}

export function OpenPregnancyCard({ bredEvent, pregCheckEvents = [] }: OpenPregnancyCardProps) {
  const sireLib    = bredEvent.sire_library
  const sireAnimal = bredEvent.sire
  const sireName   = bredEvent.sire_name_text
  const conception = bredEvent.conception_method

  return (
    <div
      className="rounded-[var(--radius-lg)] p-4 flex flex-col gap-3"
      style={{ backgroundColor: 'var(--surface-2)', border: '1px dashed var(--warning-border, #d97706)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Chip tone="warning" size="sm">OPEN PREGNANCY</Chip>
          {bredEvent.expected_calving_date && (
            <span className="type-helper" style={{ color: 'var(--text-muted)' }}>
              Est. calving: {fmtDate(bredEvent.expected_calving_date)}
            </span>
          )}
        </div>
        <span className="type-helper shrink-0" style={{ color: 'var(--text-muted)' }}>
          Bred {fmtDate(bredEvent.event_date)}
        </span>
      </div>

      {/* Preg check results */}
      {pregCheckEvents.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pregCheckEvents.map(pc => (
            <Chip
              key={pc.id}
              tone={
                pc.preg_check_result === 'confirmed' ? 'success' :
                pc.preg_check_result === 'open'      ? 'warning' : 'neutral'
              }
              size="sm"
            >
              {pc.preg_check_result?.toUpperCase() ?? 'PREG CHECK'} · {fmtDate(pc.event_date)}
            </Chip>
          ))}
        </div>
      )}

      {/* Sire */}
      {(sireLib || sireAnimal || sireName) && (
        <div className="flex items-center gap-2">
          <span className="type-helper shrink-0" style={{ color: 'var(--text-muted)' }}>SIRE</span>
          {sireLib ? (
            <>
              <Link
                href={`/genetics/sires/${sireLib.id}`}
                className="type-data-sm hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                {sireLib.bull_name}
              </Link>
              {conception === 'ai' && (
                <span
                  className="type-helper px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent)', fontSize: '10px' }}
                >
                  AI
                </span>
              )}
            </>
          ) : sireAnimal ? (
            <Link
              href={`/animals/${sireAnimal.id}`}
              className="type-data-sm hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              #{sireAnimal.tag_number}{sireAnimal.name ? ` — ${sireAnimal.name}` : ''}
            </Link>
          ) : (
            <span className="type-data-sm" style={{ color: 'var(--text-muted)' }}>{sireName}</span>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="flex flex-col gap-1.5 pl-1">
        <TimelineRow
          color="var(--info-fg)"
          label="BRED"
          date={bredEvent.event_date}
          detail={conception === 'ai' ? 'AI' : undefined}
        />
        {pregCheckEvents.map(pc => (
          <TimelineRow
            key={pc.id}
            color="#9333ea"
            label="PREG CHECK"
            date={pc.event_date}
            detail={pc.preg_check_result?.toUpperCase()}
          />
        ))}
      </div>
    </div>
  )
}
