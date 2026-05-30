'use client'

import { useState, useEffect } from 'react'
import { X, Copy, Check } from 'lucide-react'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Toggle'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AccordionSection } from '@/components/ui/Accordion'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { apiPost, apiPatch, apiDelete } from '@/lib/fetch'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Lease {
  id: string
  property_name: string
  landowner_name: string | null
  landowner_email: string | null
  landowner_phone: string | null
  acreage: number | null
  total_aum_capacity: number | null
  legal_description: string | null
  parcel_id: string | null
  parcel_ids: string[] | null
  county: string | null
  state: string | null
  start_date: string | null
  end_date: string | null
  rate_per_acre: number | null
  flat_rate: number | null
  rate_type: string | null
  payment_frequency: string | null
  renewal_alert_days: number | null
  auto_renew: boolean | null
  status: string | null
  notes: string | null
  landowner_portal_token: string | null
  landowner_portal_enabled: boolean | null
  created_at: string
}

interface LeaseSheetProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialData?: Lease | null
  mode: 'create' | 'edit'
}

const BLANK = {
  property_name: '',
  landowner_name: '', landowner_email: '', landowner_phone: '',
  acreage: '', total_aum_capacity: '',
  legal_description: '', parcel_ids_raw: '',
  county: '', state: 'CO',
  start_date: '', end_date: '',
  rate_type: 'per_acre',
  rate_per_acre: '', flat_rate: '',
  payment_frequency: 'annual',
  renewal_alert_days: '60',
  auto_renew: false,
  status: 'active',
  landowner_portal_enabled: false,
  notes: '',
}

const STATUS_OPTIONS = [
  { value: 'active',     label: 'ACTIVE' },
  { value: 'pending',    label: 'PENDING' },
  { value: 'expired',    label: 'EXPIRED' },
  { value: 'terminated', label: 'TERMINATED' },
]

const RATE_TYPE_OPTIONS = [
  { value: 'per_acre', label: '$/ACRE' },
  { value: 'flat_rate', label: 'FLAT RATE' },
]

const FREQ_OPTIONS = [
  { value: 'monthly',     label: 'MONTHLY' },
  { value: 'quarterly',   label: 'QUARTERLY' },
  { value: 'semi_annual', label: 'SEMI-ANNUAL' },
  { value: 'annual',      label: 'ANNUAL' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function LeaseSheet({ isOpen, onClose, onSuccess, initialData, mode }: LeaseSheetProps) {
  const [form, setForm] = useState({ ...BLANK })
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError]       = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [copied, setCopied]     = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && initialData) {
        setForm({
          property_name:          initialData.property_name ?? '',
          landowner_name:         initialData.landowner_name ?? '',
          landowner_email:        initialData.landowner_email ?? '',
          landowner_phone:        initialData.landowner_phone ?? '',
          acreage:                initialData.acreage != null ? String(initialData.acreage) : '',
          total_aum_capacity:     initialData.total_aum_capacity != null ? String(initialData.total_aum_capacity) : '',
          legal_description:      initialData.legal_description ?? '',
          parcel_ids_raw:         (initialData.parcel_ids ?? []).join(', '),
          county:                 initialData.county ?? '',
          state:                  initialData.state ?? 'CO',
          start_date:             initialData.start_date ?? '',
          end_date:               initialData.end_date ?? '',
          rate_type:              initialData.rate_type ?? 'per_acre',
          rate_per_acre:          initialData.rate_per_acre != null ? String(initialData.rate_per_acre) : '',
          flat_rate:              initialData.flat_rate != null ? String(initialData.flat_rate) : '',
          payment_frequency:      initialData.payment_frequency ?? 'annual',
          renewal_alert_days:     initialData.renewal_alert_days != null ? String(initialData.renewal_alert_days) : '60',
          auto_renew:             initialData.auto_renew ?? false,
          status:                 initialData.status ?? 'active',
          landowner_portal_enabled: initialData.landowner_portal_enabled ?? false,
          notes:                  initialData.notes ?? '',
        })
      } else {
        setForm({ ...BLANK })
      }
      setError('')
    }
  }, [isOpen, mode, initialData])

  const set = (k: keyof typeof BLANK) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async () => {
    if (!form.property_name.trim()) { setError('Property name is required'); return }
    setSaving(true); setError('')
    try {
      const payload: Record<string, unknown> = {
        property_name:        form.property_name.trim(),
        landowner_name:       form.landowner_name || null,
        landowner_email:      form.landowner_email || null,
        landowner_phone:      form.landowner_phone || null,
        acreage:              form.acreage ? Number(form.acreage) : null,
        total_aum_capacity:   form.total_aum_capacity ? Number(form.total_aum_capacity) : null,
        legal_description:    form.legal_description || null,
        parcel_ids:           form.parcel_ids_raw ? form.parcel_ids_raw.split(',').map(s => s.trim()).filter(Boolean) : null,
        county:               form.county || null,
        state:                form.state || null,
        start_date:           form.start_date || null,
        end_date:             form.end_date || null,
        rate_type:            form.rate_type,
        rate_per_acre:        form.rate_type === 'per_acre' && form.rate_per_acre ? Number(form.rate_per_acre) : null,
        flat_rate:            form.rate_type === 'flat_rate' && form.flat_rate ? Number(form.flat_rate) : null,
        payment_frequency:    form.payment_frequency,
        renewal_alert_days:   form.renewal_alert_days ? Number(form.renewal_alert_days) : 60,
        auto_renew:           form.auto_renew,
        status:               form.status,
        landowner_portal_enabled: form.landowner_portal_enabled,
        notes:                form.notes || null,
      }

      const url = mode === 'edit' ? `/api/leases/${initialData!.id}` : '/api/leases'
      const res  = await (mode === 'edit' ? apiPatch(url, payload) : apiPost(url, payload))
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Save failed'); return }
      onSuccess(); onClose()
    } catch { setError('Connection error') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res  = await apiDelete(`/api/leases/${initialData!.id}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Delete failed'); setConfirmDelete(false); return }
      onSuccess(); onClose()
    } catch { setError('Connection error') }
    finally { setDeleting(false); setConfirmDelete(false) }
  }

  const portalUrl = initialData?.landowner_portal_token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/landowner/${initialData.landowner_portal_token}`
    : null

  const copyPortalUrl = () => {
    if (!portalUrl) return
    navigator.clipboard.writeText(portalUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const dateSummary = [form.start_date, form.end_date].filter(Boolean).join(' → ') || undefined
  const financialSummary = form.rate_type === 'per_acre' && form.rate_per_acre
    ? `$${form.rate_per_acre}/acre`
    : form.flat_rate ? `$${form.flat_rate} flat` : undefined

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex flex-col justify-end md:justify-center md:items-center md:p-4"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      >
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
              {mode === 'create' ? 'ADD LEASE' : 'EDIT LEASE'}
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

            {/* ── PROPERTY ─────────────────────────────────────────────── */}
            <AccordionSection
              title="PROPERTY"
              defaultOpen
              summary={form.property_name || undefined}
            >
              <Field label="Property name" required>
                <Input value={form.property_name} onChange={set('property_name')} placeholder="Elk Creek Pasture" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Acreage">
                  <Input value={form.acreage} onChange={set('acreage')} type="number" step="0.1" placeholder="0.0" />
                </Field>
                <Field label="AUM capacity">
                  <Input value={form.total_aum_capacity} onChange={set('total_aum_capacity')} type="number" step="0.1" placeholder="0.0" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="County">
                  <Input value={form.county} onChange={set('county')} placeholder="Larimer" />
                </Field>
                <Field label="State">
                  <Input value={form.state} onChange={set('state')} placeholder="CO" maxLength={2} />
                </Field>
              </div>
              <Field label="Parcel IDs" helper="Comma-separated if multiple">
                <Input value={form.parcel_ids_raw} onChange={set('parcel_ids_raw')} placeholder="12345-00-001, 12345-00-002" />
              </Field>
              <Field label="Legal description">
                <Textarea value={form.legal_description} onChange={set('legal_description')} rows={2} placeholder="NE¼ Section 14, T6N R69W…" />
              </Field>
            </AccordionSection>

            {/* ── LANDOWNER ────────────────────────────────────────────── */}
            <AccordionSection
              title="LANDOWNER"
              summary={form.landowner_name || undefined}
            >
              <Field label="Name">
                <Input value={form.landowner_name} onChange={set('landowner_name')} placeholder="John Smith" />
              </Field>
              <Field label="Email">
                <Input value={form.landowner_email} onChange={set('landowner_email')} type="email" placeholder="owner@example.com" />
              </Field>
              <Field label="Phone">
                <Input value={form.landowner_phone} onChange={set('landowner_phone')} type="tel" placeholder="(555) 000-0000" />
              </Field>
            </AccordionSection>

            {/* ── FINANCIAL ────────────────────────────────────────────── */}
            <AccordionSection title="FINANCIAL" summary={financialSummary}>
              <Field label="Rate type">
                <SegmentedControl
                  value={form.rate_type}
                  onChange={v => setForm(f => ({ ...f, rate_type: v }))}
                  items={RATE_TYPE_OPTIONS}
                  block
                  size="sm"
                />
              </Field>
              {form.rate_type === 'per_acre' ? (
                <Field label="Rate ($/acre/year)">
                  <Input value={form.rate_per_acre} onChange={set('rate_per_acre')} type="number" step="0.01" min="0" placeholder="0.00" />
                </Field>
              ) : (
                <Field label="Flat rate ($)">
                  <Input value={form.flat_rate} onChange={set('flat_rate')} type="number" step="0.01" min="0" placeholder="0.00" />
                </Field>
              )}
              <Field label="Payment frequency">
                <SegmentedControl
                  value={form.payment_frequency}
                  onChange={v => setForm(f => ({ ...f, payment_frequency: v }))}
                  items={FREQ_OPTIONS}
                  block
                  size="sm"
                />
              </Field>
            </AccordionSection>

            {/* ── DATES & STATUS ───────────────────────────────────────── */}
            <AccordionSection title="DATES & STATUS" summary={dateSummary}>
              <Field label="Status">
                <SegmentedControl
                  value={form.status}
                  onChange={v => setForm(f => ({ ...f, status: v }))}
                  items={STATUS_OPTIONS}
                  block
                  size="sm"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start date">
                  <Input value={form.start_date} onChange={set('start_date')} type="date" />
                </Field>
                <Field label="End date">
                  <Input value={form.end_date} onChange={set('end_date')} type="date" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Renewal alert (days)">
                  <Input value={form.renewal_alert_days} onChange={set('renewal_alert_days')} type="number" min="0" placeholder="60" />
                </Field>
                <Field label="Auto-renew">
                  <div className="flex items-center h-10">
                    <Toggle
                      checked={form.auto_renew}
                      onChange={v => setForm(f => ({ ...f, auto_renew: v }))}
                    />
                  </div>
                </Field>
              </div>
            </AccordionSection>

            {/* ── LANDOWNER PORTAL ─────────────────────────────────────── */}
            <AccordionSection title="LANDOWNER PORTAL">
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="type-label" style={{ color: 'var(--text)' }}>Enable portal access</p>
                  <p className="type-helper" style={{ color: 'var(--text-muted)' }}>Landowner can view their animals and billing</p>
                </div>
                <Toggle
                  checked={form.landowner_portal_enabled}
                  onChange={v => setForm(f => ({ ...f, landowner_portal_enabled: v }))}
                />
              </div>
              {form.landowner_portal_enabled && portalUrl && (
                <div className="flex items-center gap-2 px-3 py-2 rounded" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <p className="type-helper flex-1 truncate" style={{ color: 'var(--text-muted)' }}>{portalUrl}</p>
                  <button type="button" onClick={copyPortalUrl} className="flex-shrink-0">
                    {copied
                      ? <Check size={14} style={{ color: 'var(--accent)' }} />
                      : <Copy size={14} style={{ color: 'var(--text-muted)' }} />}
                  </button>
                </div>
              )}
              {form.landowner_portal_enabled && !portalUrl && (
                <p className="type-helper" style={{ color: 'var(--text-muted)' }}>Save the lease to generate a portal link.</p>
              )}
            </AccordionSection>

            {/* ── NOTES ────────────────────────────────────────────────── */}
            <AccordionSection title="NOTES">
              <Field label="Notes">
                <Textarea value={form.notes} onChange={set('notes')} rows={3} placeholder="Fencing conditions, access gates, special terms…" />
              </Field>
            </AccordionSection>

            {error && (
              <p className="type-helper px-3 py-2 rounded" style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
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
                {mode === 'create' ? 'ADD LEASE' : 'SAVE CHANGES'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete lease?"
        message={`Remove "${initialData?.property_name ?? 'this lease'}"? This cannot be undone.`}
        confirmLabel="DELETE LEASE"
        loading={deleting}
      />
    </>
  )
}
