'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { apiPost } from '@/lib/fetch'

type GroupType =
  | 'whole_herd'
  | 'cows_only'
  | 'bulls_only'
  | 'heifers_only'
  | 'steers_only'
  | 'calves_only'
  | 'yearlings'
  | 'by_ear_tag_color'
  | 'custom'

interface GroupTile {
  value: GroupType
  label: string
  sub?: string
}

const GROUPS: GroupTile[] = [
  { value: 'whole_herd',   label: 'Whole Herd',   sub: 'All active animals' },
  { value: 'cows_only',    label: 'Cows',          sub: 'Sex = cow' },
  { value: 'bulls_only',   label: 'Bulls',         sub: 'Sex = bull' },
  { value: 'heifers_only', label: 'Heifers',       sub: 'Sex = heifer' },
  { value: 'steers_only',  label: 'Steers',        sub: 'Sex = steer' },
  { value: 'calves_only',  label: 'Calves',        sub: 'All calves' },
  { value: 'yearlings',    label: 'Yearlings',     sub: 'Weaned + < 2 yrs' },
  { value: 'by_ear_tag_color', label: 'By Ear Tag Color', sub: 'Filter by color' },
  { value: 'custom',       label: 'Custom List',   sub: 'Tag numbers' },
]

const EAR_TAG_COLORS = ['yellow', 'orange', 'red', 'green', 'blue', 'white', 'pink', 'purple', 'black']

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface Lease { id: string; property_name: string }

export function BulkHealthEventSheet() {
  const router = useRouter()
  const [open, setOpen]         = useState(false)
  const [step, setStep]         = useState<'group' | 'details'>('group')
  const [group, setGroup]       = useState<GroupType | null>(null)
  const [earTagColor, setEarTagColor] = useState('')
  const [customTags, setCustomTags]   = useState('')
  const [leaseFilter, setLeaseFilter] = useState<string>('')
  const [leases, setLeases]           = useState<Lease[]>([])
  const [preview, setPreview]   = useState<{ count: number; label: string } | null>(null)
  const [previewing, setPreviewing] = useState(false)

  // Form fields
  const [eventDate, setEventDate]           = useState(new Date().toISOString().slice(0, 10))
  const [drugName, setDrugName]             = useState('')
  const [doseAmount, setDoseAmount]         = useState('')
  const [doseUnit, setDoseUnit]             = useState('')
  const [withdrawalDays, setWithdrawalDays] = useState('')
  const [administeredBy, setAdministeredBy] = useState('')
  const [notes, setNotes]                   = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)

  const clearDate = withdrawalDays && eventDate
    ? addDays(eventDate, Number(withdrawalDays))
    : null

  // Load leases for optional lease filter
  useEffect(() => {
    if (!open) return
    fetch('/api/leases?status=active').then(r => r.json()).then(d => {
      setLeases(d.data ?? [])
    }).catch(() => {})
  }, [open])

  const reset = () => {
    setOpen(false)
    setStep('group')
    setGroup(null)
    setEarTagColor('')
    setCustomTags('')
    setLeaseFilter('')
    setPreview(null)
    setEventDate(new Date().toISOString().slice(0, 10))
    setDrugName('')
    setDoseAmount('')
    setDoseUnit('')
    setWithdrawalDays('')
    setAdministeredBy('')
    setNotes('')
    setError('')
    setSuccess(false)
  }

  const proceedToDetails = async () => {
    if (!group) return
    if (group === 'by_ear_tag_color' && !earTagColor) { setError('Select a color'); return }
    setError('')
    setPreviewing(true)
    try {
      const body: Record<string, unknown> = { group_type: group }
      if (group === 'by_ear_tag_color') body.group_value = earTagColor
      if (leaseFilter) body.lease_filter = leaseFilter
      const res  = await apiPost('/api/health/bulk/preview', body)
      const data = await res.json()
      if (res.ok) setPreview({ count: data.count, label: data.label })
    } catch { /* non-fatal */ }
    finally { setPreviewing(false) }
    setStep('details')
  }

  const handleSave = async () => {
    if (!drugName.trim()) { setError('Drug name is required'); return }
    setSaving(true)
    setError('')
    try {
      const groupLabel =
        group === 'by_ear_tag_color' ? `${earTagColor} ear tags` :
        group === 'custom'           ? 'Custom list' :
        GROUPS.find(g => g.value === group)?.label ?? group

      const body: Record<string, unknown> = {
        group_type:      group,
        group_label:     groupLabel,
        event_date:      eventDate,
        drug_name:       drugName || null,
        dose_amount:     doseAmount ? Number(doseAmount) : null,
        dose_unit:       doseUnit || null,
        withdrawal_days: withdrawalDays ? Number(withdrawalDays) : null,
        administered_by: administeredBy || null,
        notes:           notes || null,
      }
      if (group === 'by_ear_tag_color') body.group_value = earTagColor
      if (leaseFilter) body.lease_filter = leaseFilter
      if (group === 'custom') {
        const tags = customTags.split(/[\n,]+/).map(t => t.trim()).filter(Boolean)
        body.custom_tag_numbers = tags
      }

      const res  = await apiPost('/api/health/bulk', body)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Save failed'); return }
      setSuccess(true)
      setPreview({ count: data.animal_count, label: groupLabel ?? '' })
      router.refresh()
      setTimeout(reset, 2500)
    } catch {
      setError('Connection error — please try again')
    } finally {
      setSaving(false)
    }
  }

  const activeFilterLabel = (() => {
    if (!group) return null
    const groupLabel = GROUPS.find(g => g.value === group)?.label
    const leaseLabel = leaseFilter ? leases.find(l => l.id === leaseFilter)?.property_name : null
    if (leaseLabel && groupLabel) return `${groupLabel} on ${leaseLabel}`
    if (leaseLabel) return `On ${leaseLabel}`
    if (group && group !== 'whole_herd') return groupLabel
    return null
  })()

  return (
    <>
      <Button intent="secondary" size="sm" onClick={() => setOpen(true)}>+ BULK TREATMENT</Button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex flex-col justify-end md:justify-center md:items-center md:p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) reset() }}
        >
          <div
            className="rounded-t-[var(--radius-xl)] md:rounded-[var(--radius-xl)] w-full md:max-w-lg flex flex-col"
            style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', maxHeight: '90dvh' }}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
            </div>

            {/* Header */}
            <div className="flex items-start justify-between gap-2 px-4 pb-3 flex-shrink-0">
              <div>
                <p className="type-panel-title">Bulk Treatment</p>
                <p className="type-helper mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {step === 'group' ? 'Select the animal group to treat' : 'Enter treatment details'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {step === 'details' && (
                  <button
                    type="button"
                    className="type-helper"
                    style={{ color: 'var(--accent)' }}
                    onClick={() => { setStep('group'); setError('') }}
                  >
                    ← Change group
                  </button>
                )}
                <button type="button" onClick={reset}>
                  <X size={18} style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 px-4 pb-6" style={{ overflowY: 'scroll', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', minHeight: 0 }}>

            {/* Step 1: Group + lease selection */}
            {step === 'group' && (
              <div className="flex flex-col gap-4">

                {/* Lease filter (optional) */}
                {leases.length > 0 && (
                  <Field label="Lease (optional)" helper="Scope to animals currently on a specific lease">
                    <Select value={leaseFilter} onChange={e => setLeaseFilter(e.target.value)}>
                      <option value="">All leases</option>
                      {leases.map(l => (
                        <option key={l.id} value={l.id}>{l.property_name}</option>
                      ))}
                    </Select>
                  </Field>
                )}

                {/* Active filter chip */}
                {activeFilterLabel && (
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold"
                      style={{ background: 'var(--warning-bg, #fff7ed)', color: 'var(--warning-fg, #c2410c)', border: '1px solid var(--warning-border, #fed7aa)' }}
                    >
                      Filtered: {activeFilterLabel}
                      <button
                        type="button"
                        onClick={() => { setGroup(null); setLeaseFilter('') }}
                        style={{ marginLeft: 4 }}
                      >
                        <X size={10} />
                      </button>
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {GROUPS.map(g => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => { setGroup(g.value); setError('') }}
                      className="text-left rounded-[var(--radius-lg)] p-3 transition-colors"
                      style={{
                        backgroundColor: group === g.value ? 'var(--accent-bg)' : 'var(--surface-2)',
                        border: `1px solid ${group === g.value ? 'var(--accent)' : 'var(--border)'}`,
                        color: group === g.value ? 'var(--accent)' : 'var(--text)',
                      }}
                    >
                      <p className="type-field-label" style={{ color: 'inherit' }}>{g.label}</p>
                      {g.sub && <p className="type-helper mt-0.5" style={{ color: group === g.value ? 'var(--accent)' : 'var(--text-muted)' }}>{g.sub}</p>}
                    </button>
                  ))}
                </div>

                {group === 'by_ear_tag_color' && (
                  <Field label="Ear tag color" required>
                    <Select value={earTagColor} onChange={e => setEarTagColor(e.target.value)}>
                      <option value="">Select color…</option>
                      {EAR_TAG_COLORS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                    </Select>
                  </Field>
                )}

                {group === 'custom' && (
                  <Field label="Tag numbers" helper="One per line or comma-separated">
                    <Textarea
                      value={customTags}
                      onChange={e => setCustomTags(e.target.value)}
                      rows={4}
                      placeholder="101&#10;102&#10;103"
                    />
                  </Field>
                )}

                {error && (
                  <p className="type-helper px-3 py-2 rounded-[var(--radius-md)]"
                    style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
                    {error}
                  </p>
                )}

                <Button
                  type="button"
                  intent="primary"
                  loading={previewing}
                  disabled={!group}
                  onClick={proceedToDetails}
                >
                  CONTINUE →
                </Button>
                <button
                  type="button"
                  onClick={reset}
                  className="type-helper text-center"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Step 2: Treatment details */}
            {step === 'details' && (
              <div className="flex flex-col gap-4">
                {preview ? (
                  <ContextBanner tone="info" eyebrow="GROUP PREVIEW">
                    {preview.label}{leaseFilter && leases.find(l => l.id === leaseFilter) ? ` on ${leases.find(l => l.id === leaseFilter)!.property_name}` : ''}{' '}
                    — <strong>{preview.count} animals</strong>
                  </ContextBanner>
                ) : group && (
                  <div
                    className="rounded-[var(--radius-md)] px-3 py-2 type-helper"
                    style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                  >
                    Group: <strong>{GROUPS.find(g => g.value === group)?.label}</strong>
                    {group === 'by_ear_tag_color' && earTagColor && ` — ${earTagColor}`}
                  </div>
                )}

                <Field label="Date" required>
                  <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
                </Field>

                <Field label="Drug / Treatment" required>
                  <Input value={drugName} onChange={e => setDrugName(e.target.value)} placeholder="e.g. Draxxin, LA-200" />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Dose amount">
                    <Input type="number" step="0.01" value={doseAmount} onChange={e => setDoseAmount(e.target.value)} placeholder="0.0" />
                  </Field>
                  <Field label="Unit">
                    <Select value={doseUnit} onChange={e => setDoseUnit(e.target.value)}>
                      <option value="">Select…</option>
                      <option value="mL">mL</option>
                      <option value="cc">cc</option>
                      <option value="mg">mg</option>
                      <option value="g">g</option>
                      <option value="lb">lb</option>
                      <option value="tablet">tablet</option>
                    </Select>
                  </Field>
                </div>

                <Field label="Withdrawal days" helper="Days until meat clear">
                  <Input type="number" min="0" value={withdrawalDays} onChange={e => setWithdrawalDays(e.target.value)} placeholder="0" />
                </Field>

                {clearDate && (
                  <ContextBanner tone="warning" emphasis eyebrow="WITHDRAWAL PREVIEW">
                    Meat clear date: <strong>{clearDate}</strong>
                  </ContextBanner>
                )}

                <Field label="Administered by">
                  <Input value={administeredBy} onChange={e => setAdministeredBy(e.target.value)} placeholder="Name or role" />
                </Field>

                <Field label="Notes">
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Observations…" />
                </Field>

                {success && (
                  <ContextBanner tone="success">
                    Bulk treatment saved — {preview?.count} animals treated
                  </ContextBanner>
                )}
                {error && (
                  <p className="type-helper px-3 py-2 rounded-[var(--radius-md)]"
                    style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
                    {error}
                  </p>
                )}

                <div className="flex gap-3">
                  <Button type="button" intent="primary" loading={saving} onClick={handleSave} block>
                    SAVE BULK TREATMENT
                  </Button>
                </div>
                <button type="button" onClick={reset} className="type-helper text-center" style={{ color: 'var(--text-muted)' }}>
                  Cancel
                </button>
              </div>
            )}

            </div>{/* end scrollable content */}
          </div>
        </div>
      )}
    </>
  )
}
