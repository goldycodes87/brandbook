'use client'

import { useState, useEffect, useMemo } from 'react'
import { X } from 'lucide-react'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Toggle'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { apiPost, apiPatch } from '@/lib/fetch'
import type { Lease } from './LeaseSheet'

interface GrazingPeriod {
  id: string
  lease_id: string
  start_date: string
  end_date: string
  head_count: number
  notes: string | null
  is_paid: boolean | null
  paid_date: string | null
  paid_amount: number | null
  created_at: string
}

interface AddPeriodSheetProps {
  isOpen: boolean
  onClose: () => void
  leaseId: string
  lease: Lease
  onSuccess: () => void
  initialData?: GrazingPeriod | null
  mode: 'create' | 'edit'
}

const BLANK = {
  start_date: '', end_date: '',
  head_count: '',
  notes: '',
  is_paid: false,
  paid_date: '', paid_amount: '',
}

function daysBetween(s: string, e: string): number {
  if (!s || !e) return 0
  const start = new Date(s + 'T00:00:00')
  const end   = new Date(e + 'T00:00:00')
  const diff  = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
  return diff > 0 ? diff : 0
}

function estCost(lease: Lease, headCount: number, days: number): number | null {
  if (!days || !headCount) return null
  const rt = lease.rate_type
  if (rt === 'per_head' && lease.rate_per_head)
    return headCount * lease.rate_per_head * (days / 30)
  if (rt === 'per_acre' && lease.rate_per_acre && lease.acreage)
    return ((lease.rate_per_acre * lease.acreage) / 12) * (days / 30)
  if (rt === 'flat' && lease.flat_rate)
    return lease.flat_rate * (days / 30)
  if (rt === 'per_aum' && lease.rate_per_aum)
    return headCount * lease.rate_per_aum * (days / 30)
  return null
}

export function AddPeriodSheet({ isOpen, onClose, leaseId, lease, onSuccess, initialData, mode }: AddPeriodSheetProps) {
  const [form, setForm]     = useState({ ...BLANK })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && initialData) {
        setForm({
          start_date:  initialData.start_date ?? '',
          end_date:    initialData.end_date ?? '',
          head_count:  initialData.head_count != null ? String(initialData.head_count) : '',
          notes:       initialData.notes ?? '',
          is_paid:     initialData.is_paid ?? false,
          paid_date:   initialData.paid_date ?? '',
          paid_amount: initialData.paid_amount != null ? String(initialData.paid_amount) : '',
        })
      } else {
        setForm({ ...BLANK })
      }
      setError('')
    }
  }, [isOpen, mode, initialData])

  const set = (k: keyof typeof BLANK) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const days = useMemo(() => daysBetween(form.start_date, form.end_date), [form.start_date, form.end_date])
  const headCount = Number(form.head_count) || 0
  const cost = useMemo(() => estCost(lease, headCount, days), [lease, headCount, days])

  const costBreakdown = (() => {
    if (cost === null) return null
    const rt = lease.rate_type
    if (rt === 'per_head' && lease.rate_per_head)
      return `${headCount} head × $${lease.rate_per_head}/head/mo × ${days} days ÷ 30`
    if (rt === 'per_acre' && lease.rate_per_acre && lease.acreage)
      return `$${lease.rate_per_acre}/acre × ${lease.acreage} acres ÷ 12 mo × ${days} days ÷ 30`
    if (rt === 'flat' && lease.flat_rate)
      return `$${lease.flat_rate}/mo × ${days} days ÷ 30`
    if (rt === 'per_aum' && lease.rate_per_aum)
      return `${headCount} AUM × $${lease.rate_per_aum}/AUM × ${days} days ÷ 30`
    return null
  })()

  const handleSubmit = async () => {
    if (!form.start_date || !form.end_date) { setError('Start and end dates are required'); return }
    if (new Date(form.start_date) >= new Date(form.end_date)) { setError('Start date must be before end date'); return }
    if (!form.head_count || headCount <= 0) { setError('Head count must be greater than 0'); return }
    setSaving(true); setError('')
    try {
      const payload: Record<string, unknown> = {
        start_date:  form.start_date,
        end_date:    form.end_date,
        head_count:  headCount,
        notes:       form.notes || null,
        is_paid:     form.is_paid,
        paid_date:   form.is_paid && form.paid_date ? form.paid_date : null,
        paid_amount: form.is_paid && form.paid_amount ? Number(form.paid_amount) : null,
      }
      let res
      if (mode === 'edit' && initialData) {
        res = await apiPatch(`/api/leases/${leaseId}/periods/${initialData.id}`, payload)
      } else {
        res = await fetch(`/api/leases/${leaseId}/periods`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Save failed'); return }
      onSuccess(); onClose()
    } catch { setError('Connection error') }
    finally { setSaving(false) }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[110] flex flex-col justify-end md:justify-center md:items-center md:p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-xl md:rounded-xl md:max-w-md flex flex-col"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', maxHeight: '90dvh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <h2 className="type-panel-title" style={{ color: 'var(--text)' }}>
              {mode === 'create' ? 'ADD GRAZING PERIOD' : 'EDIT PERIOD'}
            </h2>
            <p className="type-helper" style={{ color: 'var(--text-muted)' }}>{lease.property_name}</p>
          </div>
          <button type="button" onClick={onClose}>
            <X size={20} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4"
          style={{ padding: '20px', WebkitOverflowScrolling: 'touch' }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date" required>
              <Input value={form.start_date} onChange={set('start_date')} type="date" />
            </Field>
            <Field label="End date" required>
              <Input value={form.end_date} onChange={set('end_date')} type="date" />
            </Field>
          </div>

          {days > 0 && (
            <p className="type-helper -mt-2" style={{ color: 'var(--text-muted)' }}>{days} days</p>
          )}

          <Field label="HEAD ON LEASE" required>
            <Input
              value={form.head_count}
              onChange={set('head_count')}
              type="number"
              inputMode="numeric"
              min="1"
              placeholder="12"
              style={{ fontSize: '1.25rem', height: 52, fontWeight: 600 }}
            />
          </Field>

          <Field label="Notes">
            <Input
              value={form.notes}
              onChange={set('notes')}
              placeholder="Breeding bulls only, or yearlings moved in"
            />
          </Field>

          {cost !== null && (
            <ContextBanner tone="info" title={`Est. cost: $${cost.toFixed(2)}`}>
              {costBreakdown && (
                <p className="type-helper mt-1" style={{ color: 'var(--info-fg, var(--text-muted))' }}>
                  {costBreakdown}
                </p>
              )}
            </ContextBanner>
          )}

          {mode === 'edit' && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div className="flex items-center justify-between mb-3">
                <p className="type-label" style={{ color: 'var(--text)' }}>Mark as paid</p>
                <Toggle checked={form.is_paid} onChange={v => setForm(f => ({ ...f, is_paid: v }))} />
              </div>
              {form.is_paid && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Paid date">
                    <Input value={form.paid_date} onChange={set('paid_date')} type="date" />
                  </Field>
                  <Field label="Amount paid ($)">
                    <Input value={form.paid_amount} onChange={set('paid_amount')} type="number" step="0.01" min="0" placeholder="0.00" />
                  </Field>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="type-helper px-3 py-2 rounded" style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
              {error}
            </p>
          )}
        </div>

        <div
          className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <Button type="button" intent="ghost" size="sm" onClick={onClose}>CANCEL</Button>
          <Button type="button" intent="primary" size="sm" loading={saving} onClick={handleSubmit} className="ml-auto">
            SAVE PERIOD
          </Button>
        </div>
      </div>
    </div>
  )
}
