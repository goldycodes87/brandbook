'use client'

import { useState, useEffect } from 'react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { EarTagDot } from '@/components/ui/EarTagDot'
import { apiGet, apiPost } from '@/lib/fetch'

interface SaleSheetProps {
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

interface GrazingOwner {
  id: string
  name: string
  company_name: string | null
  owner_name: string | null
  is_self: boolean | null
}

function ownerLabel(o: GrazingOwner): string {
  return o.company_name || o.owner_name || o.name
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

const BUYER_TYPE_OPTIONS = [
  { value: 'external', label: 'External' },
  { value: 'internal', label: 'Internal Transfer' },
]

export function SaleSheet({ isOpen, onClose, animal, onSuccess }: SaleSheetProps) {
  const [buyerType,      setBuyerType]      = useState<'external' | 'internal'>('external')
  const [saleDate,       setSaleDate]       = useState(today())
  const [buyerName,      setBuyerName]      = useState('')
  const [destination,    setDestination]    = useState('')
  const [buyerOwnerId,   setBuyerOwnerId]   = useState('')
  const [saleWeightLbs,  setSaleWeightLbs]  = useState('')
  const [pricePerLb,     setPricePerLb]     = useState('')
  const [grossProceeds,  setGrossProceeds]  = useState('')
  const [notes,          setNotes]          = useState('')
  const [owners,         setOwners]         = useState<GrazingOwner[]>([])
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState('')

  useEffect(() => {
    if (!isOpen) return
    apiGet('/api/grazing-owners')
      .then(r => r.json())
      .then(d => setOwners(d.data ?? []))
      .catch(() => {})
  }, [isOpen])

  // Auto-compute gross proceeds from weight × price
  useEffect(() => {
    const w = Number(saleWeightLbs)
    const p = Number(pricePerLb)
    if (w > 0 && p > 0) {
      setGrossProceeds(String((w * p).toFixed(2)))
    }
  }, [saleWeightLbs, pricePerLb])

  const handleClose = () => {
    setBuyerType('external')
    setSaleDate(today())
    setBuyerName('')
    setDestination('')
    setBuyerOwnerId('')
    setSaleWeightLbs('')
    setPricePerLb('')
    setGrossProceeds('')
    setNotes('')
    setError('')
    setSaving(false)
    onClose()
  }

  const handleSubmit = async () => {
    if (!saleDate) { setError('Sale date is required'); return }
    if (buyerType === 'internal' && !buyerOwnerId) { setError('Select the buying owner'); return }

    setSaving(true)
    setError('')
    try {
      const res = await apiPost(`/api/animals/${animal.id}/sell`, {
        sale_date:       saleDate,
        buyer:           buyerType === 'external' ? (buyerName || null) : null,
        destination:     buyerType === 'external' ? (destination || null) : null,
        sale_weight_lbs: saleWeightLbs ? Number(saleWeightLbs) : null,
        price_per_lb:    pricePerLb    ? Number(pricePerLb)    : null,
        gross_proceeds:  grossProceeds ? Number(grossProceeds) : null,
        notes:           notes || null,
        buyer_type:      buyerType,
        buyer_owner_id:  buyerType === 'internal' ? buyerOwnerId : null,
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to record sale'); return }
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
        style={{ background: 'var(--surface-1)', borderTop: '1px solid var(--border)', maxHeight: '92dvh' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 flex-shrink-0">
          <h2 className="type-heading">RECORD SALE</h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            <EarTagDot color={animal.ear_tag_color} size="sm" />
            <p className="type-helper" style={{ color: 'var(--text-muted)' }}>{tagLabel}</p>
          </div>
        </div>

        {/* Scrollable body */}
        <div
          className="flex-1 px-4 pb-4 flex flex-col gap-4"
          style={{ overflowY: 'scroll', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', minHeight: 0 }}
        >
          {/* Buyer type toggle */}
          <SegmentedControl
            value={buyerType}
            onChange={v => { setBuyerType(v as 'external' | 'internal'); setError('') }}
            items={BUYER_TYPE_OPTIONS}
            block
          />

          {buyerType === 'internal' && (
            <ContextBanner tone="info">
              Internal transfer-sale: animal stays active and is re-assigned to the new owner. Sale is recorded for Schedule F.
            </ContextBanner>
          )}

          <Field label="Sale date" required>
            <Input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
          </Field>

          {buyerType === 'external' && (
            <>
              <Field label="Buyer name">
                <Input value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder="Buyer name or company" />
              </Field>
              <Field label="Destination / venue">
                <Input value={destination} onChange={e => setDestination(e.target.value)} placeholder="e.g. Sale barn, private, auction" />
              </Field>
            </>
          )}

          {buyerType === 'internal' && (
            <Field label="Buying owner" required>
              <select
                value={buyerOwnerId}
                onChange={e => setBuyerOwnerId(e.target.value)}
                className="w-full rounded-[var(--radius-sm)] px-3 py-2 text-sm"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              >
                <option value="">— Select owner —</option>
                {owners.map(o => (
                  <option key={o.id} value={o.id}>
                    {ownerLabel(o)}{o.is_self ? ' (Me)' : ''}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Sale weight (lbs)">
              <Input type="number" step="1" min="0" value={saleWeightLbs} onChange={e => setSaleWeightLbs(e.target.value)} placeholder="1200" />
            </Field>
            <Field label="Price / lb ($)">
              <Input type="number" step="0.01" min="0" value={pricePerLb} onChange={e => setPricePerLb(e.target.value)} placeholder="1.85" />
            </Field>
          </div>

          <Field label="Gross proceeds ($)" helper="Auto-calculated from weight × price; edit if needed">
            <Input type="number" step="0.01" min="0" value={grossProceeds} onChange={e => setGrossProceeds(e.target.value)} placeholder="2220.00" />
          </Field>

          <Field label="Notes">
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Additional details…" />
          </Field>

          {error && (
            <p className="type-helper px-3 py-2 rounded" style={{ color: 'var(--danger-fg)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <Button type="button" intent="ghost" onClick={handleClose}>CANCEL</Button>
          <Button type="button" intent="primary" loading={saving} onClick={handleSubmit}>
            {buyerType === 'internal' ? 'TRANSFER & RECORD SALE' : 'RECORD SALE'}
          </Button>
        </div>
      </div>
    </div>
  )
}
