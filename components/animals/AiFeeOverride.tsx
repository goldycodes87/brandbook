'use client'

import { useEffect, useState } from 'react'
import { apiGet, apiPatch } from '@/lib/fetch'
import { Panel } from '@/components/ui/Panel'
import { Field, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'

/**
 * Per-animal AI technician fee.
 *
 * Blank = use the ranch default from Settings, which is the normal case. A
 * value here overrides that default for this animal only, and is applied when
 * a breeding is recorded (payload value wins over this, which wins over the
 * ranch default).
 */
export function AiFeeOverride({ animalId, value }: { animalId: string; value: number | null }) {
  const [fee,        setFee]        = useState(value != null ? String(value) : '')
  const [ranchFee,   setRanchFee]   = useState<number | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [savedAt,    setSavedAt]    = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => {
    apiGet('/api/settings/ranch')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        const v = d?.data?.ai_tech_fee_per_cow ?? d?.ai_tech_fee_per_cow
        if (v != null) setRanchFee(Number(v))
      })
      .catch(() => {})
  }, [])

  const save = async () => {
    setSaving(true); setError(''); setSavedAt(false)
    try {
      const trimmed = fee.trim()
      const parsed  = trimmed === '' ? null : Number(trimmed)
      if (parsed != null && (isNaN(parsed) || parsed < 0)) {
        setError('Enter a positive amount, or leave blank to use the ranch default.')
        return
      }
      const res = await apiPatch(`/api/animals/${animalId}/ai-fee`, { ai_fee_per_head: parsed })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? 'Could not save')
        return
      }
      setSavedAt(true)
    } catch {
      setError('Could not save — check your connection.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel title="AI FEE FOR THIS ANIMAL">
      <Field label="Cost per head ($)">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={fee}
          onChange={e => { setFee(e.target.value); setSavedAt(false) }}
          placeholder={ranchFee != null ? `${ranchFee} (ranch default)` : 'Ranch default'}
        />
      </Field>
      <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
        Leave blank to use the ranch default
        {ranchFee != null ? ` of $${ranchFee.toLocaleString()}` : ''} from Settings. A value here
        applies to this animal only, the next time a breeding is recorded.
      </p>
      {error && (
        <p className="type-helper mt-2" style={{ color: 'var(--danger-fg)' }}>{error}</p>
      )}
      {savedAt && !error && (
        <p className="type-helper mt-2" style={{ color: 'var(--success-fg)' }}>Saved.</p>
      )}
      <div className="mt-3">
        <Button type="button" intent="secondary" size="sm" loading={saving} onClick={save}>
          SAVE AI FEE
        </Button>
      </div>
    </Panel>
  )
}
