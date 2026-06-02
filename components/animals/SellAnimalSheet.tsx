'use client'

import { useState, useEffect } from 'react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { apiPost } from '@/lib/fetch'
import { EarTagDot } from '@/components/ui/EarTagDot'

interface SellAnimalSheetProps {
  isOpen: boolean
  onClose: () => void
  animal: { id: string; tag_number: string; name: string | null; sex: string | null; ear_tag_color?: string | null }
  onSuccess: () => void
}

const DESTINATION_OPTIONS = [
  { value: 'Private',   label: 'PRIVATE' },
  { value: 'Sale Barn', label: 'SALE BARN' },
  { value: 'Feedlot',   label: 'FEEDLOT' },
  { value: 'Retained',  label: 'RETAINED' },
]

function toNum(v: string): number | null {
  if (!v.trim()) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

export function SellAnimalSheet({ isOpen, onClose, animal, onSuccess }: SellAnimalSheetProps) {
  const [saleDate,     setSaleDate]     = useState(new Date().toISOString().slice(0, 10))
  const [destination,  setDestination]  = useState('Private')
  const [buyer,        setBuyer]        = useState('')
  const [weightLbs,    setWeightLbs]    = useState('')
  const [pricePerLb,   setPricePerLb]   = useState('')
  const [grossProceeds, setGrossProceeds] = useState('')
  const [manualGross,  setManualGross]  = useState(false)
  const [notes,        setNotes]        = useState('')
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')

  // Auto-calculate gross proceeds
  useEffect(() => {
    if (!manualGross && weightLbs && pricePerLb) {
      const calc = toNum(weightLbs)! * toNum(pricePerLb)!
      if (!isNaN(calc)) setGrossProceeds(calc.toFixed(2))
    }
  }, [weightLbs, pricePerLb, manualGross])

  const handleClose = () => {
    setSaleDate(new Date().toISOString().slice(0, 10))
    setDestination('Private')
    setBuyer('')
    setWeightLbs('')
    setPricePerLb('')
    setGrossProceeds('')
    setManualGross(false)
    setNotes('')
    setError('')
    onClose()
  }

  const handleSubmit = async () => {
    if (!saleDate) { setError('Sale date is required'); return }
    setSaving(true)
    setError('')
    try {
      const res = await apiPost(`/api/animals/${animal.id}/sell`, {
        sale_date:       saleDate,
        buyer:           buyer || null,
        destination:     destination,
        sale_weight_lbs: toNum(weightLbs),
        price_per_lb:    toNum(pricePerLb),
        gross_proceeds:  toNum(grossProceeds),
        notes:           notes || null,
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Save failed'); return }
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
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div className="px-4 pb-2 flex-shrink-0">
          <h2 className="type-heading">SELL ANIMAL</h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            <EarTagDot color={animal.ear_tag_color} size="sm" />
            <p className="type-helper" style={{ color: 'var(--text-muted)' }}>{tagLabel}</p>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 flex flex-col gap-4">
          <ContextBanner tone="warning">
            This will mark <strong>{tagLabel}</strong> as sold and record the transaction.
          </ContextBanner>

          <Field label="Sale date" required>
            <Input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
          </Field>

          <Field label="Destination">
            <SegmentedControl
              value={destination}
              onChange={v => setDestination(v)}
              items={DESTINATION_OPTIONS}
              block size="sm"
            />
          </Field>

          <Field label="Buyer">
            <Input value={buyer} onChange={e => setBuyer(e.target.value)} placeholder="Buyer name or company" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Sale weight (lbs)">
              <Input
                type="number"
                step="1"
                min="0"
                value={weightLbs}
                onChange={e => setWeightLbs(e.target.value)}
                placeholder="1200"
              />
            </Field>
            <Field label="Price per lb ($)">
              <Input
                type="number"
                step="0.001"
                min="0"
                value={pricePerLb}
                onChange={e => setPricePerLb(e.target.value)}
                placeholder="1.85"
              />
            </Field>
          </div>

          <Field label="Gross proceeds ($)" helper={!manualGross && weightLbs && pricePerLb ? 'Auto-calculated' : 'Enter manually'}>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={grossProceeds}
              onChange={e => { setManualGross(true); setGrossProceeds(e.target.value) }}
              placeholder="2220.00"
            />
          </Field>

          <Field label="Notes">
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Additional details…" />
          </Field>

          {error && (
            <p
              className="type-helper px-3 py-2 rounded"
              style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}
            >
              {error}
            </p>
          )}
        </div>

        {/* Footer — always visible */}
        <div
          className="flex items-center justify-end gap-2 px-4 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <Button type="button" intent="ghost" onClick={handleClose}>CANCEL</Button>
          <Button type="button" intent="primary" loading={saving} onClick={handleSubmit}>
            SELL {tagLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
