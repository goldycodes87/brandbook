'use client'

import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import { Panel, PanelSection } from '@/components/ui/Panel'
import { Field, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { apiPost, apiPatch, apiDelete } from '@/lib/fetch'

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
  { value: 'per_head_day',    label: 'PER HEAD/DAY' },
  { value: 'per_acre_month',  label: 'PER ACRE/MO' },
  { value: 'flat_rate',       label: 'FLAT RATE' },
]

function billingLabel(t: string) {
  if (t === 'per_head_day')   return '$/head/day'
  if (t === 'per_acre_month') return '$/acre/month'
  return 'Monthly flat rate'
}

export interface GrazingOwner {
  id: string
  name: string
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
  name: '', email: '', phone: '', address: '', city: '', state: '', zip: '',
  billing_address: '', billing_rate: '', billing_type: 'per_head_day',
  default_breed: '', default_ear_tag_color: '', default_tag_prefix: '', notes: '',
}

export function AddOwnerSheet({ isOpen, onClose, onSuccess, initialData, mode }: AddOwnerSheetProps) {
  const [form, setForm] = useState({ ...BLANK })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && initialData) {
        setForm({
          name: initialData.name ?? '',
          email: initialData.email ?? '',
          phone: initialData.phone ?? '',
          address: initialData.address ?? '',
          city: initialData.city ?? '',
          state: initialData.state ?? '',
          zip: initialData.zip ?? '',
          billing_address: initialData.billing_address ?? '',
          billing_rate: initialData.billing_rate != null ? String(initialData.billing_rate) : '',
          billing_type: initialData.billing_type ?? 'per_head_day',
          default_breed: initialData.default_breed ?? '',
          default_ear_tag_color: initialData.default_ear_tag_color ?? '',
          default_tag_prefix: initialData.default_tag_prefix ?? '',
          notes: initialData.notes ?? '',
        })
      } else {
        setForm({ ...BLANK })
      }
      setError('')
    }
  }, [isOpen, mode, initialData])

  const set = (k: keyof typeof BLANK) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const url = mode === 'edit' ? `/api/grazing-owners/${initialData!.id}` : '/api/grazing-owners'
      const res = await (mode === 'edit'
        ? apiPatch(url, { ...form, billing_rate: form.billing_rate ? Number(form.billing_rate) : null })
        : apiPost(url, { ...form, billing_rate: form.billing_rate ? Number(form.billing_rate) : null }))
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
      const res = await apiDelete(`/api/grazing-owners/${initialData!.id}`)
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
      <div
        className="fixed inset-0 z-40 flex flex-col justify-end md:justify-center md:items-center md:p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <form
          onSubmit={handleSubmit}
          className="rounded-t-[var(--radius-xl)] md:rounded-[var(--radius-xl)] overflow-y-auto w-full md:max-w-lg flex flex-col"
          style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', maxHeight: '92dvh' }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <span className="type-panel-title">
              {mode === 'create' ? 'ADD GRAZING OWNER' : 'EDIT OWNER'}
            </span>
            <button type="button" onClick={onClose} style={{ color: 'var(--text-muted)' }}>
              ✕
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">

            {/* Contact */}
            <Panel title="CONTACT">
              <PanelSection>
                <div className="flex flex-col gap-3">
                  <Field label="Name" required>
                    <Input value={form.name} onChange={set('name')} placeholder="John Smith" required />
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Email">
                      <Input value={form.email} onChange={set('email')} placeholder="john@example.com" type="email" />
                    </Field>
                    <Field label="Phone">
                      <Input value={form.phone} onChange={set('phone')} placeholder="(555) 000-0000" type="tel" />
                    </Field>
                  </div>
                  <Field label="Address">
                    <Input value={form.address} onChange={set('address')} placeholder="123 Ranch Road" />
                  </Field>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="col-span-2">
                      <Field label="City">
                        <Input value={form.city} onChange={set('city')} placeholder="Laramie" />
                      </Field>
                    </div>
                    <Field label="State">
                      <Input value={form.state} onChange={set('state')} placeholder="WY" maxLength={2} />
                    </Field>
                    <Field label="ZIP">
                      <Input value={form.zip} onChange={set('zip')} placeholder="82070" />
                    </Field>
                  </div>
                </div>
              </PanelSection>
            </Panel>

            {/* Cattle Defaults */}
            <Panel title="CATTLE DEFAULTS" subtitle="Applied automatically to their animals">
              <PanelSection>
                <div className="flex flex-col gap-3">
                  <Field label="Default ear tag color" helper="Their cattle's default tag color">
                    <div className="flex flex-wrap gap-2 mt-1">
                      {EAR_TAG_COLORS.map(c => (
                        <button
                          key={c.name}
                          type="button"
                          title={c.name}
                          onClick={() => setForm(f => ({ ...f, default_ear_tag_color: f.default_ear_tag_color === c.name ? '' : c.name }))}
                          className="relative w-8 h-8 rounded-full transition-transform duration-100 active:scale-90"
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
                </div>
              </PanelSection>
            </Panel>

            {/* Billing */}
            <Panel title="BILLING">
              <PanelSection>
                <div className="flex flex-col gap-3">
                  <Field label="Billing type">
                    <SegmentedControl
                      value={form.billing_type}
                      onChange={v => setForm(f => ({ ...f, billing_type: v }))}
                      items={BILLING_TYPES}
                      block
                      size="sm"
                    />
                  </Field>
                  <Field label={billingLabel(form.billing_type)}>
                    <Input value={form.billing_rate} onChange={set('billing_rate')} type="number" step="0.01" placeholder="0.00" />
                  </Field>
                  <Field label="Billing address" helper="If different from contact address">
                    <Input value={form.billing_address} onChange={set('billing_address')} placeholder="PO Box 123, Laramie WY" />
                  </Field>
                </div>
              </PanelSection>
            </Panel>

            {error && (
              <p className="type-helper px-3 py-2 rounded" style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex items-center gap-3 px-4 py-4 flex-shrink-0"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            {mode === 'edit' && (
              <Button type="button" intent="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                DELETE
              </Button>
            )}
            <div className="flex-1" />
            <Button type="button" intent="ghost" size="sm" onClick={onClose}>CANCEL</Button>
            <Button type="submit" intent="primary" size="sm" loading={saving}>
              {mode === 'create' ? 'ADD OWNER' : 'SAVE CHANGES'}
            </Button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete owner?"
        message={`Remove ${initialData?.name ?? 'this owner'}? This cannot be undone. Animals assigned to this owner must be reassigned first.`}
        confirmLabel="DELETE OWNER"
        loading={deleting}
      />
    </>
  )
}
