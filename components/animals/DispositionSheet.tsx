'use client'

import { useState } from 'react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { EarTagDot } from '@/components/ui/EarTagDot'
import { apiPatch, apiPost } from '@/lib/fetch'

interface DispositionSheetProps {
  isOpen: boolean
  onClose: () => void
  animal: {
    id: string
    tag_number: string
    name?: string | null
    sex: string | null
    ear_tag_color?: string | null
    owner_id?: string | null
    breeds?: { breed: string; pct: number }[] | null
  }
  onSuccess: () => void
  initialDisposition?: string
}

const DISPOSITION_TYPES = [
  { value: 'sold_auction',          title: 'SOLD — AUCTION',           description: 'Went through a sale barn' },
  { value: 'sold_private',          title: 'SOLD — PRIVATE TREATY',    description: 'Sold directly to a buyer' },
  { value: 'sold_beef',             title: 'SOLD — BEEF',              description: 'Processing / Legacy Beef Portal' },
  { value: 'retained_replacement',  title: 'RETAINED — REPLACEMENT',   description: 'Keeping as a breeder' },
  { value: 'retained_feeder',       title: 'RETAINED — FEEDER',        description: 'Keeping to grow out' },
  { value: 'deceased',              title: 'DECEASED',                  description: 'Animal died' },
]

const TRANSFER_TYPE_OPTIONS = [
  { value: 'calf_share', label: 'CALF SHARE' },
  { value: 'purchase',   label: 'PURCHASE' },
]

const CAUSE_OF_DEATH_OPTIONS = [
  'Dystocia', 'Scours', 'Pneumonia', 'Bloat', 'Injury', 'Predator', 'Unknown', 'Other',
]

function toNum(v: string): number | null {
  if (!v.trim()) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function submitLabel(disposition: string): string {
  if (disposition.startsWith('sold_')) return 'RECORD SALE'
  if (disposition.startsWith('retained_')) return 'MARK AS RETAINED'
  if (disposition === 'deceased') return 'RECORD DEATH'
  if (disposition === 'transferred') return 'TRANSFER OWNERSHIP'
  return 'CONFIRM'
}

export function DispositionSheet({
  isOpen,
  onClose,
  animal,
  onSuccess,
  initialDisposition,
}: DispositionSheetProps) {
  const [step, setStep] = useState<1 | 2>(initialDisposition ? 2 : 1)
  const [disposition, setDisposition] = useState(initialDisposition ?? '')

  // Shared date fields
  const [eventDate,       setEventDate]       = useState(today())
  // Sold auction
  const [auctionName,     setAuctionName]     = useState('')
  // Sold private
  const [buyerName,       setBuyerName]       = useState('')
  const [buyerContact,    setBuyerContact]    = useState('')
  // Shared sold fields
  const [grossProceeds,   setGrossProceeds]   = useState('')
  const [saleWeightLbs,   setSaleWeightLbs]   = useState('')
  // Sold beef
  const [harvestWeight,   setHarvestWeight]   = useState('')
  // Deceased
  const [causeOfDeath,    setCauseOfDeath]    = useState('')
  // Transfer
  const [transferType,    setTransferType]    = useState<'calf_share' | 'purchase'>('calf_share')
  const [fmv,             setFmv]             = useState('')
  const [newTagNumber,    setNewTagNumber]    = useState('')
  // Shared
  const [notes,           setNotes]           = useState('')

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const allDispositionTypes = animal.owner_id
    ? [...DISPOSITION_TYPES, { value: 'transferred', title: 'INTERNAL TRANSFER', description: 'Transfer ownership to Legacy Land & Cattle' }]
    : DISPOSITION_TYPES

  const handleClose = () => {
    setStep(initialDisposition ? 2 : 1)
    setDisposition(initialDisposition ?? '')
    setEventDate(today())
    setAuctionName('')
    setBuyerName('')
    setBuyerContact('')
    setGrossProceeds('')
    setSaleWeightLbs('')
    setHarvestWeight('')
    setCauseOfDeath('')
    setTransferType('calf_share')
    setFmv('')
    setNewTagNumber('')
    setNotes('')
    setError('')
    setSaving(false)
    onClose()
  }

  const handleSubmit = async () => {
    if (!disposition) { setError('Please select a disposition type'); return }
    if (!eventDate)   { setError('Date is required'); return }
    if (disposition === 'transferred' && !fmv) { setError('FMV at transfer is required'); return }

    setSaving(true)
    setError('')

    try {
      // Step 1: PATCH the animal
      const animalPatch: Record<string, unknown> = {
        disposition,
        disposition_date:  eventDate,
        disposition_notes: notes || null,
        status:
          disposition.startsWith('sold_')
            ? 'sold'
            : disposition === 'deceased'
              ? 'deceased'
              : 'active',
      }
      if (disposition === 'deceased') {
        animalPatch.cause_of_death = causeOfDeath || null
      }
      if (disposition === 'transferred') {
        animalPatch.owner_id = null
      }

      const patchRes = await apiPatch(`/api/animals/${animal.id}`, animalPatch)
      const patchJson = await patchRes.json()
      if (!patchRes.ok) { setError(patchJson.error ?? 'Failed to update animal'); return }

      // Step 2: If sold (auction or private), record the sale
      if (disposition === 'sold_auction' || disposition === 'sold_private') {
        const saleRes = await apiPost(`/api/animals/${animal.id}/sell`, {
          sale_date:       eventDate,
          buyer:           disposition === 'sold_auction' ? (auctionName || null) : (buyerName || null),
          destination:     disposition === 'sold_auction' ? 'Sale Barn' : 'Private',
          gross_proceeds:  toNum(grossProceeds),
          sale_weight_lbs: toNum(saleWeightLbs),
          notes:           notes || null,
        })
        const saleJson = await saleRes.json()
        if (!saleRes.ok) { setError(saleJson.error ?? 'Failed to record sale'); return }
      }

      // Step 3: If sold beef, create beef inventory record
      if (disposition === 'sold_beef') {
        const breedSummary = animal.breeds?.map(b => `${b.pct}% ${b.breed}`).join(' / ') ?? null
        const beefRes = await apiPost('/api/beef-inventory', {
          animal_id:                animal.id,
          tag_number:               animal.tag_number,
          breed_summary:            breedSummary,
          estimated_harvest_weight: toNum(harvestWeight),
        })
        const beefJson = await beefRes.json()
        if (!beefRes.ok) { setError(beefJson.error ?? 'Failed to create beef inventory record'); return }
      }

      // Step 4: If transferred, record the calf transfer
      if (disposition === 'transferred' && animal.owner_id) {
        const xferRes = await apiPost(`/api/grazing-owners/${animal.owner_id}/transfers`, {
          animal_id:       animal.id,
          from_owner_id:   animal.owner_id,
          to_owner_id:     null,
          transfer_type:   transferType,
          fmv_at_transfer: toNum(fmv),
          transfer_date:   eventDate,
        })
        const xferJson = await xferRes.json()
        if (!xferRes.ok) { setError(xferJson.error ?? 'Failed to record transfer'); return }
      }

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
          <div className="flex items-center justify-between gap-2">
            <h2 className="type-heading">RECORD DISPOSITION</h2>
            {step === 2 && (
              <button
                type="button"
                className="type-helper font-semibold"
                style={{ color: 'var(--text-muted)' }}
                onClick={() => { setStep(1); setError('') }}
              >
                ← BACK
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <EarTagDot color={animal.ear_tag_color} size="sm" />
            <p className="type-helper" style={{ color: 'var(--text-muted)' }}>{tagLabel}</p>
          </div>
          {step === 2 && disposition && (
            <div
              className="mt-2 px-2 py-1 rounded inline-flex items-center gap-1.5"
              style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-border)' }}
            >
              <span className="type-helper font-semibold" style={{ color: 'var(--accent)' }}>
                {allDispositionTypes.find(d => d.value === disposition)?.title ?? disposition.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Step indicator */}
        <div className="px-4 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div
              className="flex items-center justify-center w-5 h-5 rounded-full type-helper font-semibold"
              style={{
                background: step === 1 ? 'var(--accent)' : 'var(--success-bg)',
                color:      step === 1 ? 'var(--accent-on)' : 'var(--success-fg)',
                border:     step === 1 ? 'none' : '1px solid var(--success-border)',
                fontSize: '10px',
              }}
            >
              {step === 1 ? '1' : '✓'}
            </div>
            <span className="type-helper" style={{ color: step === 1 ? 'var(--text)' : 'var(--text-muted)' }}>
              TYPE
            </span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <div
              className="flex items-center justify-center w-5 h-5 rounded-full type-helper font-semibold"
              style={{
                background: step === 2 ? 'var(--accent)' : 'var(--surface-2)',
                color:      step === 2 ? 'var(--accent-on)' : 'var(--text-muted)',
                border:     step === 2 ? 'none' : '1px solid var(--border)',
                fontSize: '10px',
              }}
            >
              2
            </div>
            <span className="type-helper" style={{ color: step === 2 ? 'var(--text)' : 'var(--text-muted)' }}>
              DETAILS
            </span>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 flex flex-col gap-4">

          {/* ── STEP 1: Disposition type selector ── */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-3">
              {allDispositionTypes.map(type => {
                const selected = disposition === type.value
                return (
                  <div
                    key={type.value}
                    role="button"
                    tabIndex={0}
                    onClick={() => setDisposition(type.value)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setDisposition(type.value) }}
                    className="relative p-3 rounded-[var(--radius-md)] cursor-pointer select-none transition-colors"
                    style={{
                      border:     `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                      background: selected ? 'var(--accent-soft)' : 'var(--surface-2)',
                    }}
                  >
                    {selected && (
                      <div
                        className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ background: 'var(--accent)', color: 'var(--accent-on)', fontSize: '10px' }}
                      >
                        ✓
                      </div>
                    )}
                    <p
                      className="type-section-label font-bold leading-tight"
                      style={{ color: selected ? 'var(--accent)' : 'var(--text)', fontSize: '10px' }}
                    >
                      {type.title}
                    </p>
                    <p className="type-helper mt-1" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                      {type.description}
                    </p>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── STEP 2: Details form ── */}
          {step === 2 && disposition === 'sold_auction' && (
            <>
              <Field label="Sale date" required>
                <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
              </Field>
              <Field label="Sale barn / auction name">
                <Input value={auctionName} onChange={e => setAuctionName(e.target.value)} placeholder="e.g. Joplin Regional Stockyards" />
              </Field>
              <Field label="Gross sale price ($)">
                <Input type="number" step="0.01" min="0" value={grossProceeds} onChange={e => setGrossProceeds(e.target.value)} placeholder="2500.00" />
              </Field>
              <Field label="Sale weight (lbs)">
                <Input type="number" step="1" min="0" value={saleWeightLbs} onChange={e => setSaleWeightLbs(e.target.value)} placeholder="1200" />
              </Field>
              <Field label="Notes">
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Additional details…" />
              </Field>
            </>
          )}

          {step === 2 && disposition === 'sold_private' && (
            <>
              <Field label="Sale date" required>
                <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
              </Field>
              <Field label="Buyer name">
                <Input value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder="Buyer name or company" />
              </Field>
              <Field label="Buyer contact">
                <Input value={buyerContact} onChange={e => setBuyerContact(e.target.value)} placeholder="Phone or email (optional)" />
              </Field>
              <Field label="Gross sale price ($)">
                <Input type="number" step="0.01" min="0" value={grossProceeds} onChange={e => setGrossProceeds(e.target.value)} placeholder="2500.00" />
              </Field>
              <Field label="Sale weight (lbs)">
                <Input type="number" step="1" min="0" value={saleWeightLbs} onChange={e => setSaleWeightLbs(e.target.value)} placeholder="1200" />
              </Field>
              <Field label="Notes">
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Additional details…" />
              </Field>
            </>
          )}

          {step === 2 && disposition === 'sold_beef' && (
            <>
              <ContextBanner tone="info">
                This animal will be flagged for Legacy Beef Portal and removed from active herd.
              </ContextBanner>
              <Field label="Estimated harvest weight (lbs)">
                <Input type="number" step="1" min="0" value={harvestWeight} onChange={e => setHarvestWeight(e.target.value)} placeholder="1400" />
              </Field>
              <Field label="Notes">
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Additional details…" />
              </Field>
            </>
          )}

          {step === 2 && disposition === 'retained_replacement' && (
            <>
              <ContextBanner tone="success">
                This animal will be retained as a replacement breeder and remain active.
              </ContextBanner>
              <Field label="Effective date" required>
                <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
              </Field>
              <Field label="Notes">
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Additional details…" />
              </Field>
            </>
          )}

          {step === 2 && disposition === 'retained_feeder' && (
            <>
              <ContextBanner tone="neutral">
                This animal will be retained as a feeder and remain active.
              </ContextBanner>
              <Field label="Effective date" required>
                <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
              </Field>
              <Field label="Notes">
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Additional details…" />
              </Field>
            </>
          )}

          {step === 2 && disposition === 'deceased' && (
            <>
              <Field label="Date of death" required>
                <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
              </Field>
              <Field label="Cause of death">
                <Select value={causeOfDeath} onChange={e => setCauseOfDeath(e.target.value)}>
                  <option value="">— Select cause —</option>
                  {CAUSE_OF_DEATH_OPTIONS.map(cause => (
                    <option key={cause} value={cause}>{cause}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Notes">
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Additional details…" />
              </Field>
            </>
          )}

          {step === 2 && disposition === 'transferred' && (
            <>
              <Field label="Transfer date" required>
                <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
              </Field>
              <Field label="Transfer type">
                <SegmentedControl
                  value={transferType}
                  onChange={v => setTransferType(v as 'calf_share' | 'purchase')}
                  items={TRANSFER_TYPE_OPTIONS}
                  block
                  size="sm"
                />
              </Field>
              <Field label="FMV at transfer ($)" required>
                <Input type="number" step="0.01" min="0" value={fmv} onChange={e => setFmv(e.target.value)} placeholder="1500.00" />
              </Field>
              <Field label="New tag number" helper="Optional — if tag changes after transfer">
                <Input value={newTagNumber} onChange={e => setNewTagNumber(e.target.value)} placeholder="e.g. 1042A" />
              </Field>
              <Field label="Notes">
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Additional details…" />
              </Field>
            </>
          )}

          {error && (
            <p
              className="type-helper px-3 py-2 rounded"
              style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}
            >
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-4 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <Button type="button" intent="ghost" onClick={handleClose}>CANCEL</Button>
          {step === 1 ? (
            <Button
              type="button"
              intent="primary"
              disabled={!disposition}
              onClick={() => { setError(''); setStep(2) }}
            >
              NEXT →
            </Button>
          ) : (
            <Button
              type="button"
              intent="primary"
              loading={saving}
              onClick={handleSubmit}
            >
              {disposition ? submitLabel(disposition) : 'CONFIRM'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
