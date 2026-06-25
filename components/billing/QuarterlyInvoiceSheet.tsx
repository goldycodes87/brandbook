'use client'

import { useState, useEffect } from 'react'
import { X, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { Field, Input } from '@/components/ui/Field'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GrazingOwner {
  id: string
  name: string
  company_name: string | null
  owner_name: string | null
  email: string | null
}

interface LineItem {
  description: string
  quantity: number
  unit_price: number
  amount: number
}

interface InvoicePreview {
  invoice_number: string
  owner_name: string
  head_count: number
  monthly_rate: number
  quarterly_grazing: number
  expense_count: number
  line_items: LineItem[]
  total: number
  sex_breakdown?: Record<string, number>
  pair_calves?: number
}

const SEX_LABELS: Record<string, string> = {
  cow: 'COWS', heifer: 'HEIFERS', bull: 'BULLS', steer: 'STEERS', calf: 'CALVES',
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (invoice: { id: string }) => void
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function currentQuarter() {
  return Math.ceil((new Date().getMonth() + 1) / 3)
}

function currentYear() {
  return new Date().getFullYear() % 100
}

function prevQuarter(q: number, y: number): { q: number; y: number } {
  if (q === 1) return { q: 4, y: y - 1 }
  return { q: q - 1, y }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function QuarterlyInvoiceSheet({ isOpen, onClose, onSuccess }: Props) {
  const [step,         setStep]        = useState<1 | 2 | 3>(1)
  const [owners,       setOwners]      = useState<GrazingOwner[]>([])
  const [ownerId,      setOwnerId]     = useState('')
  const [billingQ,     setBillingQ]    = useState(currentQuarter())
  const [billingY,     setBillingY]    = useState(currentYear())
  const [expenseQ,     setExpenseQ]    = useState(prevQuarter(currentQuarter(), currentYear()).q)
  const [expenseY,     setExpenseY]    = useState(prevQuarter(currentQuarter(), currentYear()).y)
  const [dueDate,      setDueDate]     = useState('')
  const [preview,      setPreview]     = useState<InvoicePreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [creating,     setCreating]    = useState(false)
  const [error,        setError]       = useState('')

  useEffect(() => {
    if (!isOpen) {
      setStep(1); setOwnerId(''); setPreview(null); setError('')
      setBillingQ(currentQuarter()); setBillingY(currentYear())
      const pq = prevQuarter(currentQuarter(), currentYear())
      setExpenseQ(pq.q); setExpenseY(pq.y)
      setDueDate('')
      return
    }
    fetch('/api/grazing-owners')
      .then(r => r.json())
      .then(j => setOwners(j.data ?? []))
  }, [isOpen])

  const ownerDisplay = (o: GrazingOwner) => o.company_name || o.owner_name || o.name

  const handlePreview = async () => {
    if (!ownerId) { setError('Select an owner'); return }
    setError(''); setLoadingPreview(true)
    try {
      const res = await fetch('/api/billing/generate-quarterly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_id: ownerId,
          billing_quarter: billingQ,
          billing_year: billingY,
          expense_quarter: expenseQ,
          expense_year: expenseY,
          due_date: dueDate || null,
          dry_run: true,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Preview failed'); return }
      setPreview(json.preview)
      setStep(2)
    } catch {
      setError('Connection error')
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleCreate = async () => {
    setError(''); setCreating(true)
    try {
      const res = await fetch('/api/billing/generate-quarterly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_id: ownerId,
          billing_quarter: billingQ,
          billing_year: billingY,
          expense_quarter: expenseQ,
          expense_year: expenseY,
          due_date: dueDate || null,
          dry_run: false,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to create invoice'); return }
      setStep(3)
      setTimeout(() => { onSuccess(json.invoice); onClose() }, 1200)
    } catch {
      setError('Connection error')
    } finally {
      setCreating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end md:items-center md:justify-center">
      <div className="absolute inset-0 bg-black/50 z-0" onClick={onClose} />
      <div
        className="relative w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl flex flex-col z-10"
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          maxHeight: '90dvh',
          height: '90dvh',
          touchAction: 'pan-y',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }}
        >
          <div>
            <p className="type-helper font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {step === 1 ? 'QUARTERLY INVOICE' : step === 2 ? 'PREVIEW' : 'CREATED'}
            </p>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
              {step === 1 ? 'Select Owner & Period' : step === 2 ? 'Review Line Items' : 'Invoice Created'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full" style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div
          className="flex-1 px-5 py-4 flex flex-col gap-4"
          style={{ overflowY: 'scroll', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', minHeight: 0, flex: '1 1 0' }}
        >

          {step === 3 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <div className="text-5xl">✅</div>
              <p className="font-bold text-lg" style={{ color: 'var(--text)' }}>Invoice Created!</p>
              <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
                #{preview?.invoice_number} — {fmt(preview?.total ?? 0)}
              </p>
            </div>
          )}

          {step === 1 && (
            <>
              {/* Owner */}
              <Field label="Owner">
                <select
                  value={ownerId}
                  onChange={e => setOwnerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', color: 'var(--text)' }}
                >
                  <option value="">Select owner…</option>
                  {owners.map(o => (
                    <option key={o.id} value={o.id}>{ownerDisplay(o)}</option>
                  ))}
                </select>
              </Field>

              {/* Billing quarter */}
              <div className="flex gap-3">
                <Field label="Billing Quarter" className="flex-1">
                  <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    {[1,2,3,4].map(q => (
                      <button
                        key={q} type="button"
                        onClick={() => setBillingQ(q)}
                        className="flex-1 py-2 text-sm font-semibold transition-colors"
                        style={{
                          background: billingQ === q ? 'var(--accent)' : 'var(--surface-1)',
                          color:      billingQ === q ? 'var(--accent-fg, #fff)' : 'var(--text-muted)',
                          borderRight: q < 4 ? '1px solid var(--border)' : undefined,
                        }}
                      >
                        Q{q}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Year" className="w-24">
                  <Input
                    type="number"
                    value={billingY}
                    onChange={e => setBillingY(Number(e.target.value))}
                    min={20} max={99}
                  />
                </Field>
              </div>

              {/* Expense quarter */}
              <div className="flex gap-3">
                <Field label="Expense Quarter (to include)" className="flex-1">
                  <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    {[1,2,3,4].map(q => (
                      <button
                        key={q} type="button"
                        onClick={() => setExpenseQ(q)}
                        className="flex-1 py-2 text-sm font-semibold transition-colors"
                        style={{
                          background: expenseQ === q ? 'var(--accent)' : 'var(--surface-1)',
                          color:      expenseQ === q ? 'var(--accent-fg, #fff)' : 'var(--text-muted)',
                          borderRight: q < 4 ? '1px solid var(--border)' : undefined,
                        }}
                      >
                        Q{q}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Year" className="w-24">
                  <Input
                    type="number"
                    value={expenseY}
                    onChange={e => setExpenseY(Number(e.target.value))}
                    min={20} max={99}
                  />
                </Field>
              </div>

              {/* Due date */}
              <Field label="Due Date (optional)">
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </Field>
            </>
          )}

          {step === 2 && preview && (
            <>
              <div
                className="rounded-lg px-4 py-3 flex flex-col gap-1"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
              >
                <div className="flex justify-between">
                  <span className="type-helper font-semibold" style={{ color: 'var(--text-muted)' }}>OWNER</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{preview.owner_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="type-helper font-semibold" style={{ color: 'var(--text-muted)' }}>INVOICE #</span>
                  <span className="font-mono text-sm" style={{ color: 'var(--text)' }}>{preview.invoice_number}</span>
                </div>
                {preview.sex_breakdown && Object.entries(preview.sex_breakdown)
                  .filter(([, count]) => count > 0)
                  .sort(([a], [b]) => {
                    const order = ['cow', 'heifer', 'bull', 'steer', 'calf', 'other']
                    return order.indexOf(a) - order.indexOf(b)
                  })
                  .map(([sex, count]) => (
                    <div key={sex} className="flex justify-between">
                      <span className="type-helper font-semibold" style={{ color: 'var(--text-muted)' }}>
                        {SEX_LABELS[sex] ?? sex.toUpperCase() + 'S'}
                      </span>
                      <span className="text-sm" style={{ color: 'var(--text)' }}>{count}</span>
                    </div>
                  ))
                }
                {(preview.pair_calves ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="type-helper font-semibold" style={{ color: 'var(--text-muted)' }}>PAIR CALVES</span>
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      -{preview.pair_calves} (billed w/ dam)
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="type-helper font-semibold" style={{ color: 'var(--text-muted)' }}>BILLABLE UNITS</span>
                  <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                    {preview.head_count} @ {fmt(preview.monthly_rate)}/mo
                  </span>
                </div>
              </div>

              {/* Line items */}
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <div className="grid text-xs font-semibold px-3 py-2" style={{ gridTemplateColumns: '1fr auto auto', background: 'var(--surface-2)', color: 'var(--text-muted)', gap: 8 }}>
                  <span>DESCRIPTION</span>
                  <span className="text-right">QTY</span>
                  <span className="text-right">AMOUNT</span>
                </div>
                {preview.line_items.map((item, i) => (
                  <div
                    key={i}
                    className="grid px-3 py-3 text-sm"
                    style={{
                      gridTemplateColumns: '1fr auto auto',
                      gap: 8,
                      borderTop: '1px solid var(--border)',
                      color: 'var(--text)',
                    }}
                  >
                    <span style={{ color: 'var(--text)' }}>{item.description}</span>
                    <span className="text-right" style={{ color: 'var(--text-muted)' }}>{item.quantity}</span>
                    <span className="text-right font-semibold" style={{ color: 'var(--gold-fg)' }}>{fmt(item.amount)}</span>
                  </div>
                ))}
                <div
                  className="flex justify-between px-3 py-3 font-bold"
                  style={{ borderTop: '2px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)' }}
                >
                  <span>TOTAL</span>
                  <span style={{ color: 'var(--gold-fg)' }}>{fmt(preview.total)}</span>
                </div>
              </div>

              {dueDate && (
                <p className="type-helper text-center" style={{ color: 'var(--text-muted)' }}>
                  Due {new Date(dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </>
          )}

          {error && <ContextBanner tone="danger">{error}</ContextBanner>}
        </div>

        {/* Footer */}
        {step !== 3 && (
          <div className="px-5 py-4 flex gap-3" style={{ borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            {step === 2 && (
              <Button intent="ghost" size="sm" onClick={() => setStep(1)}>← BACK</Button>
            )}
            <div className="flex-1" />
            {step === 1 && (
              <Button intent="primary" size="sm" loading={loadingPreview} onClick={handlePreview}>
                PREVIEW <ChevronRight size={14} className="ml-1" />
              </Button>
            )}
            {step === 2 && (
              <Button intent="primary" size="sm" loading={creating} onClick={handleCreate}>
                CREATE INVOICE
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
