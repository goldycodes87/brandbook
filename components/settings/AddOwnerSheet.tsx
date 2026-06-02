'use client'

import { useState, useEffect } from 'react'
import { Check, X } from 'lucide-react'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AccordionSection } from '@/components/ui/Accordion'
import { BrandDrawingPad } from '@/components/settings/BrandDrawingPad'
import { apiPost, apiPatch, apiDelete } from '@/lib/fetch'

const normalizeColor = (c: string) => c ? c.charAt(0).toUpperCase() + c.slice(1).toLowerCase() : c

// ─── Constants ────────────────────────────────────────────────────────────────

const EAR_TAG_COLORS = [
  { name: 'Yellow',  hex: '#F5C518' },
  { name: 'Orange',  hex: '#F97316' },
  { name: 'White',   hex: '#F3F4F6' },
  { name: 'Green',   hex: '#22C55E' },
  { name: 'Blue',    hex: '#3B82F6' },
  { name: 'Red',     hex: '#EF4444' },
  { name: 'Pink',    hex: '#EC4899' },
  { name: 'Purple',  hex: '#A855F7' },
  { name: 'Silver',  hex: '#9CA3AF' },
  { name: 'Black',   hex: '#1F2937' },
]

const BILLING_TYPES = [
  { value: 'per_head_day',   label: 'PER HEAD/DAY' },
  { value: 'per_head_month', label: '$/HEAD/MONTH' },
  { value: 'flat_rate',      label: 'FLAT RATE' },
]

function billingRateLabel(t: string) {
  if (t === 'per_head_day')   return '$/HEAD/DAY'
  if (t === 'per_head_month') return '$/HEAD/MONTH'
  return 'FLAT RATE/MONTH'
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GrazingOwner {
  id: string
  name: string
  company_name?: string | null
  owner_name?: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  billing_address: string | null
  billing_rate: number | null
  billing_type: string | null
  brand_photo_url: string | null
  brand_drawing_url?: string | null
  default_breed: string | null
  default_ear_tag_color: string | null
  default_tag_prefix: string | null
  notes: string | null
}

interface AddOwnerSheetProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialData?: GrazingOwner | null
  mode: 'create' | 'edit'
}

const BLANK = {
  company_name: '', owner_name: '',
  email: '', phone: '', address: '', city: '', state: '', zip: '',
  billing_address: '', billing_rate: '', billing_type: 'per_head_day',
  default_breed: '', default_ear_tag_color: '', default_tag_prefix: '',
  brand_photo_url: '', brand_drawing_url: '',
  notes: '',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddOwnerSheet({ isOpen, onClose, onSuccess, initialData, mode }: AddOwnerSheetProps) {
  const [form, setForm]               = useState({ ...BLANK })
  const [saving, setSaving]           = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [error, setError]             = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && initialData) {
        setForm({
          company_name:          initialData.company_name ?? '',
          owner_name:            initialData.owner_name ?? initialData.name ?? '',
          email:                 initialData.email ?? '',
          phone:                 initialData.phone ?? '',
          address:               initialData.address ?? '',
          city:                  initialData.city ?? '',
          state:                 initialData.state ?? '',
          zip:                   initialData.zip ?? '',
          billing_address:       initialData.billing_address ?? '',
          billing_rate:          initialData.billing_rate != null ? String(initialData.billing_rate) : '',
          billing_type:          initialData.billing_type ?? 'per_head_day',
          default_breed:         initialData.default_breed ?? '',
          default_ear_tag_color: initialData.default_ear_tag_color ?? '',
          default_tag_prefix:    initialData.default_tag_prefix ?? '',
          brand_photo_url:       initialData.brand_photo_url ?? '',
          brand_drawing_url:     initialData.brand_drawing_url ?? '',
          notes:                 initialData.notes ?? '',
        })
      } else {
        setForm({ ...BLANK })
      }
      setError('')
    }
  }, [isOpen, mode, initialData])

  const set = (k: keyof typeof BLANK) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async () => {
    if (!form.owner_name.trim() && !form.company_name.trim()) {
      setError('Enter at least a company name or owner name')
      return
    }
    setSaving(true)
    setError('')
    try {
      const displayName = (form.company_name || form.owner_name).trim()
      const payload = {
        name:            displayName,
        company_name:    form.company_name || null,
        owner_name:      form.owner_name || null,
        email:           form.email || null,
        phone:           form.phone || null,
        address:         form.address || null,
        city:            form.city || null,
        state:           form.state || null,
        zip:             form.zip || null,
        billing_address: form.billing_address || null,
        billing_rate:    form.billing_rate ? Number(form.billing_rate) : null,
        billing_type:    form.billing_type || null,
        brand_photo_url: form.brand_photo_url || null,
        brand_drawing_url: form.brand_drawing_url || null,
        default_breed:         form.default_breed || null,
        default_ear_tag_color: form.default_ear_tag_color || null,
        default_tag_prefix:    form.default_tag_prefix || null,
        notes:           form.notes || null,
      }

      const url = mode === 'edit' ? `/api/grazing-owners/${initialData!.id}` : '/api/grazing-owners'
      const res  = await (mode === 'edit' ? apiPatch(url, payload) : apiPost(url, payload))
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Save failed'); return }
      onSuccess()
      onClose()
    } catch { setError('Connection error') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res  = await apiDelete(`/api/grazing-owners/${initialData!.id}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Delete failed'); setConfirmDelete(false); return }
      onSuccess()
      onClose()
    } catch { setError('Connection error') }
    finally { setDeleting(false); setConfirmDelete(false) }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] flex flex-col justify-end md:justify-center md:items-center md:p-4"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      >
        {/* Sheet */}
        <div
          className="w-full rounded-t-xl md:rounded-xl md:max-w-lg flex flex-col"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', maxHeight: '90dvh' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Handle bar — mobile only */}
          <div className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
          </div>

          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <h2 className="type-panel-title" style={{ color: 'var(--text)' }}>
              {mode === 'create' ? 'ADD GRAZING OWNER' : 'EDIT OWNER'}
            </h2>
            <button type="button" onClick={onClose}>
              <X size={20} style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>

          {/* Scrollable body */}
          <div
            className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3"
            style={{ padding: '16px', WebkitOverflowScrolling: 'touch' }}
          >

            {/* ── Section 1: CONTACT ───────────────────────────────────── */}
            <AccordionSection
              title="CONTACT"
              defaultOpen
              summary={form.company_name || form.owner_name || undefined}
            >
              <Field label="Company Name" helper="Business or ranch name">
                <Input
                  value={form.company_name}
                  onChange={set('company_name')}
                  placeholder="e.g. P&L Cattle LLC"
                />
              </Field>
              <Field label="Owner Name" helper="Primary contact person">
                <Input
                  value={form.owner_name}
                  onChange={set('owner_name')}
                  placeholder="e.g. Doug Goldberg"
                />
              </Field>
              <Field label="Email">
                <Input value={form.email} onChange={set('email')} type="email" placeholder="owner@example.com" />
              </Field>
              <Field label="Phone">
                <Input value={form.phone} onChange={set('phone')} type="tel" placeholder="(555) 000-0000" />
              </Field>
              <Field label="Address">
                <Input value={form.address} onChange={set('address')} placeholder="123 Ranch Road" />
              </Field>
              <Field label="City">
                <Input value={form.city} onChange={set('city')} placeholder="Laramie" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="State">
                  <Input value={form.state} onChange={set('state')} placeholder="WY" maxLength={2} />
                </Field>
                <Field label="ZIP">
                  <Input value={form.zip} onChange={set('zip')} placeholder="82070" />
                </Field>
              </div>
            </AccordionSection>

            {/* ── Section 2: CATTLE DEFAULTS ───────────────────────────── */}
            <AccordionSection title="CATTLE DEFAULTS">
              <Field label="Default ear tag color" helper="Applied to their animals automatically">
                <div className="flex flex-wrap gap-2 mt-1">
                  {EAR_TAG_COLORS.map(c => (
                    <button
                      key={c.name}
                      type="button"
                      title={c.name}
                      onClick={() => setForm(f => ({ ...f, default_ear_tag_color: f.default_ear_tag_color === c.name ? '' : normalizeColor(c.name) }))}
                      className="relative w-9 h-9 rounded-full transition-transform duration-100 active:scale-90"
                      style={{
                        backgroundColor: c.hex,
                        border: form.default_ear_tag_color === c.name ? '3px solid var(--accent)' : '2px solid var(--border)',
                        boxShadow: form.default_ear_tag_color === c.name ? '0 0 0 1px var(--accent)' : undefined,
                      }}
                    >
                      {form.default_ear_tag_color === c.name && (
                        <Check
                          size={14}
                          className="absolute inset-0 m-auto"
                          style={{ color: c.name === 'White' || c.name === 'Yellow' || c.name === 'Silver' ? '#000' : '#fff' }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Default tag prefix" helper="Added before tag numbers for their animals">
                <Input value={form.default_tag_prefix} onChange={set('default_tag_prefix')} placeholder="e.g. J for J001" />
              </Field>
              <Field label="Default breed">
                <Input value={form.default_breed} onChange={set('default_breed')} placeholder="e.g. Angus" list="owner-breed-list" />
                <datalist id="owner-breed-list">
                  {['Angus', 'Hereford', 'Simmental', 'Charolais', 'Limousin', 'Gelbvieh', 'Red Angus', 'Shorthorn', 'Black Baldy', 'Crossbred'].map(b => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </Field>
            </AccordionSection>

            {/* ── Section 3: BILLING ───────────────────────────────────── */}
            <AccordionSection title="BILLING">
              <Field label="Billing type">
                <SegmentedControl
                  value={form.billing_type}
                  onChange={v => setForm(f => ({ ...f, billing_type: v }))}
                  items={BILLING_TYPES}
                  block
                  size="sm"
                />
              </Field>
              <Field label={billingRateLabel(form.billing_type)}>
                <Input
                  value={form.billing_rate}
                  onChange={set('billing_rate')}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                />
              </Field>
              <Field label="Billing address" helper="If different from contact address">
                <Input value={form.billing_address} onChange={set('billing_address')} placeholder="PO Box 123, Laramie WY" />
              </Field>
            </AccordionSection>

            {/* ── Section 4: BRAND ─────────────────────────────────────── */}
            <AccordionSection title="BRAND">
              <BrandDrawingPad
                existingUrl={form.brand_photo_url || form.brand_drawing_url || undefined}
                onSave={url => setForm(f => ({ ...f, brand_photo_url: url }))}
              />
            </AccordionSection>

            {/* ── Section 5: NOTES ─────────────────────────────────────── */}
            <AccordionSection title="NOTES">
              <Field label="Notes">
                <Textarea
                  value={form.notes}
                  onChange={set('notes')}
                  rows={3}
                  placeholder="Any additional info about this owner"
                />
              </Field>
            </AccordionSection>

            {error && (
              <p className="type-helper px-3 py-2 rounded" style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
                {error}
              </p>
            )}
          </div>

          {/* Footer — always visible */}
          <div
            className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            {mode === 'edit' && (
              <Button type="button" intent="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                DELETE
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" intent="ghost" size="sm" onClick={onClose}>CANCEL</Button>
              <Button type="button" intent="primary" size="sm" loading={saving} onClick={handleSubmit}>
                {mode === 'create' ? 'ADD OWNER' : 'SAVE CHANGES'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete owner?"
        message={`Remove ${initialData?.company_name ?? initialData?.owner_name ?? initialData?.name ?? 'this owner'}? This cannot be undone. Animals assigned to this owner must be reassigned first.`}
        confirmLabel="DELETE OWNER"
        loading={deleting}
      />
    </>
  )
}
