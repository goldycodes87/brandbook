'use client'

import { useState, useEffect } from 'react'
import { Check, X } from 'lucide-react'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AccordionSection } from '@/components/ui/Accordion'
import { BrandDrawingPad } from '@/components/settings/BrandDrawingPad'
import { apiPost, apiPatch, apiDelete, apiGet } from '@/lib/fetch'
import { Toggle } from '@/components/ui/Toggle'
import { ContextBanner } from '@/components/ui/ContextBanner'

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

const BLANK_CONTRACT = {
  effective_date:                 '',
  expiration_date:                '',
  include_calf_sharing:           false,
  calf_share_pct:                 '50',
  calf_share_rounding:            'down',
  calf_selection_method:          'operator_choice',
  calf_transfer_basis:            'fmv',
  carry_forward_shortfall:        true,
  calf_shortfall_carried:         '0',
  death_loss_allowable_pct:       '10',
  death_loss_split_threshold_pct: '25',
  sale_fee_auction_pct:           '3',
  sale_fee_private_flat:          '350',
  contract_notes:                 '',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddOwnerSheet({ isOpen, onClose, onSuccess, initialData, mode }: AddOwnerSheetProps) {
  const [form, setForm]               = useState({ ...BLANK })
  const [contractForm, setContractForm] = useState({ ...BLANK_CONTRACT })
  const [existingContractId, setExistingContractId] = useState<string | null>(null)
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
      setContractForm({ ...BLANK_CONTRACT })
      setExistingContractId(null)
      // Load existing contract in edit mode
      if (mode === 'edit' && initialData?.id) {
        apiGet(`/api/grazing-owners/${initialData.id}/contract`)
          .then(r => r.json())
          .then(d => {
            const c = d.data
            if (!c) return
            setExistingContractId(c.id)
            setContractForm({
              effective_date:                 c.effective_date                 ?? '',
              expiration_date:                c.expiration_date                ?? '',
              include_calf_sharing:           c.calf_share_pct != null,
              calf_share_pct:                 c.calf_share_pct != null ? String(c.calf_share_pct) : '50',
              calf_share_rounding:            c.calf_share_rounding            ?? 'down',
              calf_selection_method:          c.calf_selection_method          ?? 'operator_choice',
              calf_transfer_basis:            c.calf_transfer_basis            ?? 'fmv',
              carry_forward_shortfall:        c.carry_forward_shortfall        ?? true,
              calf_shortfall_carried:         c.calf_shortfall_carried != null ? String(c.calf_shortfall_carried) : '0',
              death_loss_allowable_pct:       c.death_loss_allowable_pct       != null ? String(c.death_loss_allowable_pct) : '10',
              death_loss_split_threshold_pct: c.death_loss_split_threshold_pct != null ? String(c.death_loss_split_threshold_pct) : '25',
              sale_fee_auction_pct:           c.sale_fee_auction_pct           != null ? String(c.sale_fee_auction_pct)           : '3',
              sale_fee_private_flat:          c.sale_fee_private_flat          != null ? String(c.sale_fee_private_flat)          : '350',
              contract_notes:                 c.notes                          ?? '',
            })
          })
          .catch(() => {})
      }
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

      // Save contract if any contract field is filled
      const ownerId = mode === 'edit' ? initialData!.id : json.data?.id
      const hasContract = contractForm.effective_date || contractForm.include_calf_sharing ||
        contractForm.death_loss_allowable_pct !== '10' || contractForm.sale_fee_auction_pct !== '3'
      if (ownerId && hasContract) {
        const contractPayload = {
          effective_date:                 contractForm.effective_date                 || null,
          expiration_date:                contractForm.expiration_date                || null,
          calf_share_pct:                 contractForm.include_calf_sharing ? Number(contractForm.calf_share_pct) : null,
          calf_share_rounding:            contractForm.include_calf_sharing ? contractForm.calf_share_rounding         : null,
          calf_selection_method:          contractForm.include_calf_sharing ? contractForm.calf_selection_method       : null,
          calf_transfer_basis:            contractForm.include_calf_sharing ? contractForm.calf_transfer_basis         : null,
          carry_forward_shortfall:        contractForm.carry_forward_shortfall,
          calf_shortfall_carried:         Number(contractForm.calf_shortfall_carried) || 0,
          death_loss_allowable_pct:       Number(contractForm.death_loss_allowable_pct) || 10,
          death_loss_split_threshold_pct: Number(contractForm.death_loss_split_threshold_pct) || 25,
          sale_fee_auction_pct:           Number(contractForm.sale_fee_auction_pct) || 3,
          sale_fee_private_flat:          Number(contractForm.sale_fee_private_flat) || 350,
          notes:                          contractForm.contract_notes || null,
        }
        const contractUrl = `/api/grazing-owners/${ownerId}/contract`
        if (existingContractId) {
          await apiPatch(contractUrl, contractPayload)
        } else {
          await apiPost(contractUrl, contractPayload)
        }
      }

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

            {/* ── Section 4: GRAZING CONTRACT ──────────────────────────── */}
            <AccordionSection title="GRAZING CONTRACT" summary="Terms of the grazing agreement">
              <Field label="Effective date">
                <Input type="date" value={contractForm.effective_date} onChange={e => setContractForm(f => ({ ...f, effective_date: e.target.value }))} />
              </Field>
              <Field label="Expiration date" helper="Leave blank for ongoing agreement">
                <Input type="date" value={contractForm.expiration_date} onChange={e => setContractForm(f => ({ ...f, expiration_date: e.target.value }))} />
              </Field>

              <div className="pt-1 pb-1" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                <p className="type-section-label mb-2" style={{ color: 'var(--text-muted)' }}>CALF SHARING</p>
                <Toggle
                  label="Include calf sharing"
                  checked={contractForm.include_calf_sharing}
                  onChange={v => setContractForm(f => ({ ...f, include_calf_sharing: v }))}
                />
                {contractForm.include_calf_sharing && (
                  <div className="flex flex-col gap-3 mt-3">
                    <Field label="Operator share %" helper="% of live calf crop at weaning">
                      <Input type="number" min="0" max="100" value={contractForm.calf_share_pct}
                        onChange={e => setContractForm(f => ({ ...f, calf_share_pct: e.target.value }))} />
                    </Field>
                    <Field label="Rounding">
                      <SegmentedControl value={contractForm.calf_share_rounding}
                        onChange={v => setContractForm(f => ({ ...f, calf_share_rounding: v }))}
                        items={[{ value: 'down', label: 'ROUND DOWN' }, { value: 'up', label: 'ROUND UP' }, { value: 'nearest', label: 'NEAREST' }]}
                        size="sm" block />
                    </Field>
                    <Field label="Selection method">
                      <SegmentedControl value={contractForm.calf_selection_method}
                        onChange={v => setContractForm(f => ({ ...f, calf_selection_method: v }))}
                        items={[{ value: 'operator_choice', label: 'OPERATOR CHOICE' }, { value: 'by_sex', label: 'BY SEX' }, { value: 'alternating', label: 'ALTERNATING' }]}
                        size="sm" block />
                    </Field>
                    <Field label="Transfer basis">
                      <SegmentedControl value={contractForm.calf_transfer_basis}
                        onChange={v => setContractForm(f => ({ ...f, calf_transfer_basis: v }))}
                        items={[{ value: 'fmv', label: 'FAIR MARKET VALUE' }, { value: 'zero', label: '$0' }]}
                        size="sm" block />
                    </Field>
                    <Toggle label="Carry forward shortfall"
                      description="If rounding results in 0 calves, carry the shortfall to next year"
                      checked={contractForm.carry_forward_shortfall}
                      onChange={v => setContractForm(f => ({ ...f, carry_forward_shortfall: v }))} />
                    <Field label="Current shortfall" helper="Calves carried forward from prior years">
                      <Input type="number" min="0" value={contractForm.calf_shortfall_carried}
                        onChange={e => setContractForm(f => ({ ...f, calf_shortfall_carried: e.target.value }))} />
                    </Field>
                  </div>
                )}
              </div>

              <div className="pt-1 pb-1" style={{ borderBottom: '1px solid var(--border)' }}>
                <p className="type-section-label mb-3" style={{ color: 'var(--text-muted)' }}>DEATH LOSS</p>
                <div className="flex flex-col gap-3">
                  <Field label="Allowable loss %" helper="Below this % is owner's loss">
                    <Input type="number" min="0" max="100" value={contractForm.death_loss_allowable_pct}
                      onChange={e => setContractForm(f => ({ ...f, death_loss_allowable_pct: e.target.value }))} />
                  </Field>
                  <Field label="Split threshold %" helper="Above this % becomes operator's loss">
                    <Input type="number" min="0" max="100" value={contractForm.death_loss_split_threshold_pct}
                      onChange={e => setContractForm(f => ({ ...f, death_loss_split_threshold_pct: e.target.value }))} />
                  </Field>
                  <ContextBanner tone="info" eyebrow="DEATH LOSS TIERS">
                    0–{contractForm.death_loss_allowable_pct || '10'}%: Owner&apos;s loss
                    {' · '}{contractForm.death_loss_allowable_pct || '10'}–{contractForm.death_loss_split_threshold_pct || '25'}%: Split
                    {' · '}{contractForm.death_loss_split_threshold_pct || '25'}%+: Operator&apos;s loss
                  </ContextBanner>
                </div>
              </div>

              <div className="pt-1 pb-1">
                <p className="type-section-label mb-3" style={{ color: 'var(--text-muted)' }}>SALE HANDLING</p>
                <div className="flex flex-col gap-3">
                  <Field label="Auction fee %" helper="% of gross sale price">
                    <Input type="number" min="0" step="0.1" value={contractForm.sale_fee_auction_pct}
                      onChange={e => setContractForm(f => ({ ...f, sale_fee_auction_pct: e.target.value }))} />
                  </Field>
                  <Field label="Private treaty flat fee ($)" helper="Flat fee per head for private sales">
                    <Input type="number" min="0" value={contractForm.sale_fee_private_flat}
                      onChange={e => setContractForm(f => ({ ...f, sale_fee_private_flat: e.target.value }))} />
                  </Field>
                </div>
              </div>

              <Field label="Contract notes">
                <Textarea value={contractForm.contract_notes} rows={2}
                  onChange={e => setContractForm(f => ({ ...f, contract_notes: e.target.value }))}
                  placeholder="Any additional terms or notes" />
              </Field>
            </AccordionSection>

            {/* ── Section 5: BRAND ─────────────────────────────────────── */}
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
