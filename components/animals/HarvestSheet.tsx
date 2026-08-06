'use client'

import { useState } from 'react'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { EarTagDot } from '@/components/ui/EarTagDot'
import { apiPost } from '@/lib/fetch'

interface HarvestSheetProps {
  isOpen: boolean
  onClose: () => void
  animal: {
    id: string
    tag_number: string
    name?: string | null
    ear_tag_color?: string | null
  }
  onSuccess: () => void
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function HarvestSheet({ isOpen, onClose, animal, onSuccess }: HarvestSheetProps) {
  const [harvestDate,     setHarvestDate]     = useState(today())
  const [destination,     setDestination]     = useState('')
  const [finalWeightLbs,  setFinalWeightLbs]  = useState('')
  const [notes,           setNotes]           = useState('')
  const [saving,          setSaving]          = useState(false)
  const [error,           setError]           = useState('')

  const handleClose = () => {
    setHarvestDate(today())
    setDestination('')
    setFinalWeightLbs('')
    setNotes('')
    setError('')
    setSaving(false)
    onClose()
  }

  const handleSubmit = async () => {
    if (!harvestDate) { setError('Harvest date is required'); return }
    setSaving(true)
    setError('')
    try {
      const res = await apiPost(`/api/animals/${animal.id}/harvest`, {
        harvest_date:     harvestDate,
        destination:      destination || null,
        final_weight_lbs: finalWeightLbs ? Number(finalWeightLbs) : null,
        notes:            notes || null,
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to record harvest'); return }
      handleClose()
      onSuccess()
    } catch {
      setError('Connection error')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const tagLabel = `${animal.tag_number}${animal.name ? ` · ${animal.name}` : ''}`

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col justify-end md:justify-center md:items-center md:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div
        className="rounded-t-[var(--radius-xl)] md:rounded-[var(--radius-xl)] w-full md:max-w-lg flex flex-col"
        style={{ background: 'var(--surface-1)', borderTop: '1px solid var(--border)', maxHeight: '90dvh' }}
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        <div className="px-4 pb-3 flex-shrink-0">
          <h2 className="type-heading">HARVEST / SEND TO BUTCHER</h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            <EarTagDot color={animal.ear_tag_color} size="sm" />
            <p className="type-helper" style={{ color: 'var(--text-muted)' }}>{tagLabel}</p>
          </div>
        </div>

        <div
          className="flex-1 px-4 pb-4 flex flex-col gap-4"
          style={{ overflowY: 'scroll', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', minHeight: 0 }}
        >
          <ContextBanner tone="warning">
            This will remove the animal from the active herd and flag it for beef production.
          </ContextBanner>

          <Field label="Harvest date" required>
            <Input type="date" value={harvestDate} onChange={e => setHarvestDate(e.target.value)} />
          </Field>

          <Field label="Locker / butcher" helper="Name and location of processing facility">
            <Input value={destination} onChange={e => setDestination(e.target.value)} placeholder="e.g. Smith's Custom Meats, Lamar MO" />
          </Field>

          <Field label="Final weight (lbs)" helper="Live weight or rail weight at processing">
            <Input type="number" step="1" min="0" value={finalWeightLbs} onChange={e => setFinalWeightLbs(e.target.value)} placeholder="1350" />
          </Field>

          <Field label="Notes">
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Cut instructions, notes…" />
          </Field>

          {error && (
            <p className="type-helper px-3 py-2 rounded" style={{ color: 'var(--danger-fg)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <Button type="button" intent="ghost" onClick={handleClose}>CANCEL</Button>
          <Button type="button" intent="danger" loading={saving} onClick={handleSubmit}>
            SEND TO HARVEST
          </Button>
        </div>
      </div>
    </div>
  )
}
