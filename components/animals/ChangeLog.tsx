'use client'

import { useEffect, useState } from 'react'
import { Panel } from '@/components/ui/Panel'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { apiGet } from '@/lib/fetch'
import { fmtTs } from '@/lib/format'

interface Change {
  id: string
  action: 'insert' | 'update' | 'delete'
  changed_fields: Record<string, { from: unknown; to: unknown }>
  actor: string | null
  changed_at: string
}

/**
 * Field names people use, not the ones the table uses.
 *
 * A change log nobody can read is a change log nobody checks, and "dob" or
 * "disposition_notes" is not what somebody standing in a corral calls it.
 * Anything missing here falls back to the column name with its underscores
 * knocked out, which is ugly but never wrong.
 */
const FIELD_LABELS: Record<string, string> = {
  tag_number: 'Ear tag',
  ear_tag_color: 'Tag colour',
  ear_tag_number: 'Tag number',
  dob: 'Date of birth',
  dob_estimated: 'Date of birth estimated',
  sex: 'Sex',
  status: 'Status',
  breed: 'Breed',
  breed_percentage: 'Breed %',
  birth_weight_lbs: 'Birth weight',
  weaning_date: 'Weaning date',
  weaning_weight_lbs: 'Weaning weight',
  purchase_price: 'Purchase price',
  purchase_date: 'Purchase date',
  owner_id: 'Owner',
  dam_id: 'Dam',
  sire_id: 'Sire',
  donor_dam_id: 'Donor dam',
  cull_flagged_at: 'Cull flag',
  cull_reason: 'Cull reason',
  disposition: 'Disposition',
  disposition_date: 'Disposition date',
  disposition_notes: 'Disposition notes',
  breeding_eligible: 'In the breeding herd',
  ai_fee_per_head: 'AI fee per head',
  manual_grazing_cost_override: 'Grazing cost override',
  beef_production_flagged_at: 'Flagged for beef',
  notes: 'Notes',
  name: 'Name',
}

const labelFor = (field: string) =>
  FIELD_LABELS[field] ?? field.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())

/** Fields whose values are ids — shown as "set"/"cleared" rather than a UUID. */
const ID_FIELDS = new Set(['owner_id', 'dam_id', 'sire_id', 'donor_dam_id', 'pair_animal_id',
                           'sire_library_id', 'ranch_id', 'id'])

function renderValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  if (ID_FIELDS.has(field)) return 'set'
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`
  if (typeof value === 'object') return 'changed'

  const s = String(value)
  // A timestamp in a diff is noise at full precision.
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10)
  return s.length > 60 ? `${s.slice(0, 57)}…` : s
}

const ACTION_TONE = {
  insert: { tone: 'success' as const, label: 'CREATED' },
  update: { tone: 'gold'    as const, label: 'EDITED'  },
  delete: { tone: 'danger'  as const, label: 'DELETED' },
}

/**
 * What has happened to this animal record, and who did it.
 *
 * Fed by a database trigger rather than by the app, so an edit made anywhere —
 * the animal form, Chute Mode, a bulk import, RancherAI, or a hand-run query —
 * lands here without that code knowing this screen exists.
 */
export function ChangeLog({ animalId }: { animalId: string }) {
  const [changes, setChanges] = useState<Change[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    let cancelled = false
    apiGet(`/api/animals/${animalId}/history`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        if (d.error) setError(d.error)
        else setChanges(d.data ?? [])
      })
      .catch(() => { if (!cancelled) setError('Could not load the change log.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [animalId])

  if (loading) {
    return <p className="type-body py-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading…</p>
  }

  if (error) {
    return (
      <p className="text-sm px-3 py-2 rounded-[var(--radius-md)]"
         style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
        {error}
      </p>
    )
  }

  if (changes.length === 0) {
    return (
      <EmptyState
        variant="neutral"
        title="No changes recorded"
        body="The log starts from when it was switched on, so anything edited before that is not here. Every change from now on is."
      />
    )
  }

  return (
    <Panel title="CHANGE LOG" subtitle={`${changes.length} change${changes.length === 1 ? '' : 's'}`} padding="none">
      <div className="flex flex-col">
        {changes.map(c => {
          const meta = ACTION_TONE[c.action] ?? ACTION_TONE.update
          const fields = Object.entries(c.changed_fields ?? {})

          return (
            <div key={c.id} className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <Chip tone={meta.tone} size="sm">{meta.label}</Chip>
                <span className="type-helper" style={{ color: 'var(--text-muted)' }}>
                  {fmtTs(c.changed_at)}
                </span>
                <span className="type-helper" style={{ color: 'var(--text-muted)' }}>
                  · {c.actor ?? 'unattributed'}
                </span>
              </div>

              {/* A creation lists what it started with; an edit shows the move. */}
              {c.action === 'update' ? (
                <ul className="flex flex-col gap-1">
                  {fields.map(([field, v]) => (
                    <li key={field} className="text-sm flex flex-wrap items-baseline gap-x-2">
                      <span style={{ color: 'var(--text-muted)' }}>{labelFor(field)}</span>
                      <span style={{ color: 'var(--text-disabled)' }}>
                        {renderValue(field, v?.from)}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>→</span>
                      <span style={{ color: 'var(--text)', fontWeight: 500 }}>
                        {renderValue(field, v?.to)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
                  {fields.length} field{fields.length === 1 ? '' : 's'}
                  {c.action === 'insert' ? ' recorded' : ' removed'}
                  {fields.length > 0 && ' · '}
                  {fields.slice(0, 6).map(([f]) => labelFor(f)).join(', ')}
                  {fields.length > 6 && ` +${fields.length - 6} more`}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
