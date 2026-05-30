'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Zap, AlertCircle } from 'lucide-react'
import { AccordionSection } from '@/components/ui/Accordion'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { apiGet, apiPost, apiPatch } from '@/lib/fetch'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GrazingOwner {
  id: string
  name: string
  company_name: string | null
  owner_name: string | null
  email: string | null
  phone: string | null
}

interface OwnerLease {
  id: string
  property_name: string | null
  rate_type: string | null
}

interface ExpenseCategory {
  id: string
  name: string
}

interface LineItem {
  description: string
  amount: string
}

interface ExpenseSplit {
  category: string
  description: string
  total_amount: string
  split_type: 'percent' | 'flat'
  percent: string
  owner_amount: string
}

interface HerdSummary {
  total_units: number
  owner_units: number
  owner_pct: number
  unweaned_excluded: number
  periods_used: number
  owner_animals: Array<{ tag_number: string; sex: string | null; ear_tag_color: string | null }>
}

interface InvoiceFormProps {
  mode: 'create' | 'edit'
  initialData?: Record<string, unknown>
  onSuccess: (invoice: Record<string, unknown>) => void
  onCancel: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(s: string): number {
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

function fmtMoney(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function addDays(date: string, days: number): string {
  if (!date) return ''
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function ownerLabel(o: GrazingOwner): string {
  return o.company_name || o.owner_name || o.name
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InvoiceForm({ mode, initialData, onSuccess, onCancel }: InvoiceFormProps) {
  const [owners, setOwners]           = useState<GrazingOwner[]>([])
  const [ownerLeases, setOwnerLeases] = useState<OwnerLease[]>([])
  const [categories, setCategories]   = useState<ExpenseCategory[]>([])
  const [saving, setSaving]           = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [error, setError]             = useState('')
  const [generateMsg, setGenerateMsg] = useState('')
  const [generating, setGenerating]   = useState(false)
  const [herdSummary, setHerdSummary] = useState<HerdSummary | null>(null)

  // Form fields
  const [ownerId, setOwnerId]         = useState((initialData?.owner_id as string) ?? '')
  const [leaseId, setLeaseId]         = useState('')
  const [periodStart, setPeriodStart] = useState((initialData?.period_start as string) ?? '')
  const [periodEnd, setPeriodEnd]     = useState((initialData?.period_end as string) ?? '')
  const [dueDate, setDueDate]         = useState((initialData?.due_date as string) ?? '')
  const [notes, setNotes]             = useState((initialData?.notes as string) ?? '')
  const [lineItems, setLineItems]     = useState<LineItem[]>(
    ((initialData?.line_items as Array<{ description: string; amount: number }>) ?? []).map(li => ({
      description: li.description,
      amount: String(li.amount),
    }))
  )
  const [expenses, setExpenses]       = useState<ExpenseSplit[]>(
    ((initialData?.expense_splits as Array<Record<string, unknown>>) ?? []).map(e => ({
      category:     String(e.category ?? ''),
      description:  String(e.description ?? ''),
      total_amount: String(e.total_amount ?? ''),
      split_type:   (e.split_type as 'percent' | 'flat') ?? 'flat',
      percent:      String(e.percent ?? ''),
      owner_amount: String(e.owner_amount ?? ''),
    }))
  )

  const selectedOwner = owners.find(o => o.id === ownerId)

  // Load owners and categories
  useEffect(() => {
    apiGet('/api/grazing-owners').then(r => r.json()).then(d => setOwners(d.data ?? []))
    apiGet('/api/billing/expenses/categories').then(r => r.json()).then(d => setCategories(d.data ?? []))
  }, [])

  // Load leases where this owner has active animals
  useEffect(() => {
    if (!ownerId) { setOwnerLeases([]); setLeaseId(''); return }
    setOwnerLeases([])
    setLeaseId('')
    setHerdSummary(null)
    // Fetch assignments for this owner then get unique leases
    fetch(`/api/animals?owner_id=${ownerId}&limit=500&status=active`)
      .then(r => r.json())
      .then(async d => {
        const animals: Array<{ id: string }> = d.data ?? []
        if (!animals.length) return
        // Get leases via AUM data — fetch assignments for each lease isn't straightforward;
        // instead, call a dedicated endpoint: /api/grazing-owners/{id}/leases
        // For now fall back to fetching all active leases
        const lRes = await apiGet('/api/leases?status=active&limit=100')
        const lJson = await lRes.json()
        const leases: OwnerLease[] = (lJson.data ?? []).map((l: { id: string; property_name: string | null; rate_type: string | null }) => ({
          id: l.id, property_name: l.property_name, rate_type: l.rate_type,
        }))
        setOwnerLeases(leases)
        if (leases.length === 1) setLeaseId(leases[0].id)
      })
      .catch(() => {})
  }, [ownerId])

  // Auto-set due date when period_end changes (in create mode)
  useEffect(() => {
    if (mode === 'create' && periodEnd && !dueDate) {
      setDueDate(addDays(periodEnd, 30))
    }
  }, [periodEnd, mode, dueDate])

  // Totals
  const lineTotal    = lineItems.reduce((s, li) => s + toNum(li.amount), 0)
  const expenseTotal = expenses.reduce((s, e) => s + toNum(e.owner_amount), 0)
  const grandTotal   = lineTotal + expenseTotal

  // Auto-generate from records
  const handleGenerate = useCallback(async () => {
    if (!ownerId || !leaseId || !periodStart || !periodEnd) {
      setGenerateMsg('Select owner, lease, period start, and period end first.')
      return
    }
    setGenerating(true)
    setGenerateMsg('')
    setHerdSummary(null)
    try {
      const ownerName = ownerLabel(owners.find(o => o.id === ownerId) ?? { id: '', name: '', company_name: null, owner_name: null, email: null, phone: null })
      const leaseName = ownerLeases.find(l => l.id === leaseId)?.property_name ?? 'lease'

      const res  = await apiPost('/api/billing/generate', {
        owner_id: ownerId, lease_id: leaseId, period_start: periodStart, period_end: periodEnd,
      })
      const json = await res.json()
      if (!res.ok) { setGenerateMsg(json.error ?? 'Generation failed'); return }

      // Apply suggested line items
      if (json.suggested_line_items?.length > 0) {
        setLineItems(json.suggested_line_items.map((li: { description: string; amount: number }) => ({
          description: li.description,
          amount: String(li.amount),
        })))
      }

      // Apply suggested expense splits
      if (json.suggested_expenses?.length > 0) {
        setExpenses(json.suggested_expenses.map((e: {
          category_name: string; description: string; total_amount: number; owner_amount: number
        }) => ({
          category:     e.category_name,
          description:  e.description,
          total_amount: String(e.total_amount),
          split_type:   'percent' as const,
          percent:      String(json.herd_summary?.owner_pct ?? ''),
          owner_amount: String(e.owner_amount),
        })))
      }

      // Show herd summary
      if (json.herd_summary) setHerdSummary(json.herd_summary)

      const hs     = json.herd_summary
      const lCount = json.suggested_line_items?.length ?? 0
      const eCount = json.suggested_expenses?.length ?? 0
      if (lCount > 0 || eCount > 0) {
        setGenerateMsg(`Generated ${lCount} line item${lCount !== 1 ? 's' : ''} and ${eCount} expense split${eCount !== 1 ? 's' : ''} for ${ownerName} on ${leaseName}`)
      } else if (hs?.owner_units === 0) {
        setGenerateMsg(`${ownerName} has no animals on ${leaseName} for this period`)
      } else {
        setGenerateMsg('No charges found for this period')
      }
    } catch {
      setGenerateMsg('Connection error')
    } finally {
      setGenerating(false)
    }
  }, [ownerId, leaseId, periodStart, periodEnd, owners, ownerLeases])

  // Line item helpers
  const addLineItem = () => setLineItems(prev => [...prev, { description: '', amount: '' }])
  const removeLineItem = (i: number) => setLineItems(prev => prev.filter((_, idx) => idx !== i))
  const updateLineItem = (i: number, field: keyof LineItem, val: string) =>
    setLineItems(prev => prev.map((li, idx) => idx === i ? { ...li, [field]: val } : li))

  // Expense helpers
  const addExpense = () => setExpenses(prev => [...prev, {
    category: categories[0]?.name ?? '', description: '', total_amount: '', split_type: 'flat', percent: '', owner_amount: '',
  }])
  const removeExpense = (i: number) => setExpenses(prev => prev.filter((_, idx) => idx !== i))
  const updateExpense = (i: number, field: keyof ExpenseSplit, val: string) =>
    setExpenses(prev => prev.map((e, idx) => {
      if (idx !== i) return e
      const updated = { ...e, [field]: val }
      if (field === 'total_amount' || field === 'percent') {
        const ta = toNum(updated.total_amount)
        const pct = toNum(updated.percent)
        if (updated.split_type === 'percent' && ta > 0 && pct > 0) {
          updated.owner_amount = (ta * pct / 100).toFixed(2)
        }
      }
      if (field === 'split_type' && val === 'flat') {
        updated.percent = ''
      }
      return updated
    }))

  const handleSubmit = async () => {
    if (!ownerId) { setError('Select an owner'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        owner_id:     ownerId,
        period_start: periodStart || null,
        period_end:   periodEnd   || null,
        due_date:     dueDate     || null,
        notes:        notes       || null,
        line_items: lineItems.filter(li => li.description).map(li => ({
          description: li.description,
          amount: toNum(li.amount),
        })),
        expense_splits: expenses.filter(e => e.description || e.owner_amount).map(e => ({
          category:     e.category,
          description:  e.description,
          total_amount: toNum(e.total_amount),
          split_type:   e.split_type,
          percent:      toNum(e.percent),
          owner_amount: toNum(e.owner_amount),
        })),
      }

      const url = mode === 'edit' ? `/api/billing/${(initialData as { id: string }).id}` : '/api/billing'
      const res  = await (mode === 'edit' ? apiPatch(url, payload) : apiPost(url, payload))
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Save failed'); return }
      onSuccess(json.data)
    } catch {
      setError('Connection error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this invoice? This cannot be undone.')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/billing/${(initialData as { id: string }).id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Delete failed'); return }
      onSuccess({})
    } catch {
      setError('Connection error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* SECTION 1: OWNER & PERIOD */}
      <AccordionSection title="OWNER & PERIOD" defaultOpen>
        <Field label="Owner" required>
          <Select value={ownerId} onChange={e => setOwnerId(e.target.value)}>
            <option value="">Select owner…</option>
            {owners.map(o => (
              <option key={o.id} value={o.id}>{ownerLabel(o)}</option>
            ))}
          </Select>
        </Field>

        {selectedOwner && (
          <div className="type-helper px-2 flex flex-col gap-0.5" style={{ color: 'var(--text-muted)' }}>
            {selectedOwner.email && <span>{selectedOwner.email}</span>}
            {selectedOwner.phone && <span>{selectedOwner.phone}</span>}
            {!selectedOwner.email && (
              <span className="flex items-center gap-1" style={{ color: 'var(--warning-fg, #f59e0b)' }}>
                <AlertCircle size={12} />
                No email — cannot send invoice electronically
              </span>
            )}
          </div>
        )}

        {ownerId && (
          <Field label="Lease" helper="Required for auto-generate">
            <Select value={leaseId} onChange={e => { setLeaseId(e.target.value); setHerdSummary(null); setGenerateMsg('') }}>
              <option value="">Select lease…</option>
              {ownerLeases.map(l => (
                <option key={l.id} value={l.id}>
                  {l.property_name ?? l.id} {l.rate_type ? `(${l.rate_type.replace('_', ' ')})` : ''}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Period start">
            <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
          </Field>
          <Field label="Period end">
            <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
          </Field>
        </div>

        <Field label="Due date">
          <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </Field>
      </AccordionSection>

      {/* SECTION 2: GRAZING CHARGES */}
      <AccordionSection title="GRAZING CHARGES" defaultOpen>
        <Button
          type="button"
          intent="secondary"
          size="sm"
          loading={generating}
          onClick={handleGenerate}
          leading={<Zap size={14} />}
        >
          AUTO-GENERATE FROM RECORDS
        </Button>

        {generateMsg && (
          <ContextBanner
            tone={generating ? 'neutral' : (generateMsg.includes('Generated') ? 'success' : 'neutral')}
            eyebrow={generating ? undefined : (generateMsg.includes('Generated') ? 'AUTO-GENERATED' : undefined)}
          >
            {generateMsg}
          </ContextBanner>
        )}

        {herdSummary && (
          <div
            className="rounded-lg p-3 flex flex-col gap-2"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>HERD COMPOSITION</p>
            <p className="text-sm" style={{ color: 'var(--text)' }}>
              <strong>{herdSummary.owner_units}</strong> of <strong>{herdSummary.total_units}</strong> billable head
              {' '}= <strong style={{ color: 'var(--accent)' }}>{herdSummary.owner_pct.toFixed(1)}%</strong> of herd
              {herdSummary.unweaned_excluded > 0 && (
                <span style={{ color: 'var(--text-muted)' }}> · {herdSummary.unweaned_excluded} unweaned calves excluded</span>
              )}
              {herdSummary.periods_used > 0 && (
                <span style={{ color: 'var(--text-muted)' }}> · {herdSummary.periods_used} logged period{herdSummary.periods_used !== 1 ? 's' : ''} used</span>
              )}
            </p>
            {herdSummary.owner_animals.length > 0 && (
              <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
                {herdSummary.owner_animals.slice(0, 8).map(a =>
                  `${a.ear_tag_color ? a.ear_tag_color + ' ' : ''}${a.tag_number}`
                ).join(', ')}
                {herdSummary.owner_animals.length > 8 && ` +${herdSummary.owner_animals.length - 8} more`}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {lineItems.map((li, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex-1">
                <Input
                  value={li.description}
                  onChange={e => updateLineItem(i, 'description', e.target.value)}
                  placeholder={`Grazing — 12 head × 30 days`}
                />
              </div>
              <div style={{ width: 100 }}>
                <div className="flex items-center gap-1">
                  <span className="type-helper" style={{ color: 'var(--text-muted)' }}>$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={li.amount}
                    onChange={e => updateLineItem(i, 'amount', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeLineItem(i)}
                className="mt-2 flex-shrink-0"
                style={{ color: 'var(--text-muted)' }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        <Button type="button" intent="ghost" size="sm" onClick={addLineItem} leading={<Plus size={14} />}>
          ADD LINE ITEM
        </Button>

        {lineItems.length > 0 && (
          <p className="type-helper text-right" style={{ color: 'var(--text-muted)' }}>
            Grazing subtotal: <strong style={{ color: 'var(--text)' }}>{fmtMoney(lineTotal)}</strong>
          </p>
        )}
      </AccordionSection>

      {/* SECTION 3: EXPENSE SPLITS */}
      <AccordionSection title="EXPENSE SPLITS" defaultOpen={false}>
        <div className="flex flex-col gap-3">
          {expenses.map((e, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 p-3 rounded-lg"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <Field label="Category">
                    <Select value={e.category} onChange={ev => updateExpense(i, 'category', ev.target.value)}>
                      {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      <option value="Custom">Custom…</option>
                    </Select>
                  </Field>
                </div>
                <button
                  type="button"
                  onClick={() => removeExpense(i)}
                  className="mt-6 flex-shrink-0"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <Field label="Description">
                <Input
                  value={e.description}
                  onChange={ev => updateExpense(i, 'description', ev.target.value)}
                  placeholder="e.g. June mineral delivery"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Total amount ($)">
                  <Input
                    type="number" step="0.01" min="0"
                    value={e.total_amount}
                    onChange={ev => updateExpense(i, 'total_amount', ev.target.value)}
                    placeholder="0.00"
                  />
                </Field>
              </div>

              <Field label="Split type">
                <SegmentedControl
                  items={[{ value: 'percent', label: '% OF HERD' }, { value: 'flat', label: 'FLAT AMOUNT' }]}
                  value={e.split_type}
                  onChange={v => updateExpense(i, 'split_type', v)}
                  size="sm"
                />
              </Field>

              {e.split_type === 'percent' ? (
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Field label="Percentage" helper="Owner's % of total herd">
                      <Input
                        type="number" step="1" min="0" max="100"
                        value={e.percent}
                        onChange={ev => updateExpense(i, 'percent', ev.target.value)}
                        placeholder="33"
                      />
                    </Field>
                  </div>
                  {e.owner_amount && (
                    <p className="type-helper pb-2" style={{ color: 'var(--text-muted)' }}>
                      = <strong style={{ color: 'var(--text)' }}>${e.owner_amount}</strong>
                    </p>
                  )}
                </div>
              ) : (
                <Field label="Owner's amount ($)">
                  <Input
                    type="number" step="0.01" min="0"
                    value={e.owner_amount}
                    onChange={ev => updateExpense(i, 'owner_amount', ev.target.value)}
                    placeholder="150.00"
                  />
                </Field>
              )}
            </div>
          ))}
        </div>

        <Button type="button" intent="ghost" size="sm" onClick={addExpense} leading={<Plus size={14} />}>
          ADD EXPENSE
        </Button>

        {expenses.length > 0 && (
          <p className="type-helper text-right" style={{ color: 'var(--text-muted)' }}>
            Expense total: <strong style={{ color: 'var(--text)' }}>{fmtMoney(expenseTotal)}</strong>
          </p>
        )}
      </AccordionSection>

      {/* SECTION 4: NOTES */}
      <AccordionSection title="NOTES" defaultOpen={false}>
        <Field label="Notes" helper="Printed on invoice">
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Any additional information for the owner…"
          />
        </Field>
      </AccordionSection>

      {/* TOTALS — always visible */}
      <div
        className="rounded-lg p-4 flex flex-col gap-2"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between">
          <span className="type-helper" style={{ color: 'var(--text-muted)' }}>Grazing charges</span>
          <span className="type-helper">{fmtMoney(lineTotal)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="type-helper" style={{ color: 'var(--text-muted)' }}>Expense splits</span>
          <span className="type-helper">{fmtMoney(expenseTotal)}</span>
        </div>
        <div
          className="flex items-center justify-between pt-2 mt-1"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>TOTAL DUE</span>
          <span className="font-bold text-lg" style={{ color: 'var(--gold-fg, #d97706)' }}>
            {fmtMoney(grandTotal)}
          </span>
        </div>
        {dueDate && (
          <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
            Due: {new Date(dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </div>

      {error && (
        <p
          className="type-helper px-3 py-2 rounded"
          style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}
        >
          {error}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center gap-3 pt-2">
        {mode === 'edit' && (initialData as { status?: string })?.status === 'draft' && (
          <Button type="button" intent="danger" size="sm" loading={deleting} onClick={handleDelete}>
            DELETE
          </Button>
        )}
        <div className="flex gap-2 ml-auto">
          <Button type="button" intent="ghost" onClick={onCancel}>CANCEL</Button>
          <Button type="button" intent="primary" loading={saving} onClick={handleSubmit}>
            {mode === 'create' ? 'CREATE INVOICE' : 'SAVE CHANGES'}
          </Button>
        </div>
      </div>
    </div>
  )
}
