'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { apiPost, apiPatch } from '@/lib/fetch'

interface LeaseExpense {
  id: string
  lease_id: string
  category_name: string
  description: string | null
  total_amount: number
  expense_date: string | null
  period_start: string | null
  period_end: string | null
  receipt_url: string | null
  created_at: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  leaseId: string
  onSuccess: () => void
  initialData?: LeaseExpense | null
  mode?: 'create' | 'edit'
}

const EXPENSE_CATEGORIES = [
  'Hay', 'Mineral/Supplements', 'Vet Bills', 'Pasture Treatment',
  'Water', 'Salt', 'Labor', 'Equipment', 'Other',
]

export function AddLeaseExpenseSheet({ isOpen, onClose, leaseId, onSuccess, initialData, mode = 'create' }: Props) {
  const [category,     setCategory]     = useState('')
  const [description,  setDescription]  = useState('')
  const [totalAmount,  setTotalAmount]  = useState('')
  const [expenseDate,  setExpenseDate]  = useState('')
  const [periodStart,  setPeriodStart]  = useState('')
  const [periodEnd,    setPeriodEnd]    = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  useEffect(() => {
    if (!isOpen) return
    if (mode === 'edit' && initialData) {
      setCategory(initialData.category_name ?? '')
      setDescription(initialData.description ?? '')
      setTotalAmount(String(initialData.total_amount ?? ''))
      setExpenseDate(initialData.expense_date ?? '')
      setPeriodStart(initialData.period_start ?? '')
      setPeriodEnd(initialData.period_end ?? '')
    } else {
      setCategory(EXPENSE_CATEGORIES[0])
      setDescription('')
      setTotalAmount('')
      setExpenseDate(new Date().toISOString().slice(0, 10))
      setPeriodStart('')
      setPeriodEnd('')
    }
    setError('')
  }, [isOpen, mode, initialData])

  const handleSave = async () => {
    if (!category || !totalAmount) { setError('Category and amount are required'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        category_name: category,
        description:   description || null,
        total_amount:  parseFloat(totalAmount),
        expense_date:  expenseDate || null,
        period_start:  periodStart || null,
        period_end:    periodEnd   || null,
      }
      const url = mode === 'edit' && initialData
        ? `/api/leases/${leaseId}/expenses/${initialData.id}`
        : `/api/leases/${leaseId}/expenses`
      const res  = await (mode === 'edit' ? apiPatch(url, payload) : apiPost(url, payload))
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Save failed'); return }
      onSuccess(); onClose()
    } catch {
      setError('Connection error')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div
        className="rounded-t-2xl flex flex-col"
        style={{ background: 'var(--surface-0)', maxHeight: '90dvh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <div>
            <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>SHARED EXPENSE</p>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
              {mode === 'edit' ? 'Edit Expense' : 'Add Expense'}
            </h2>
          </div>
          <button type="button" onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6 flex flex-col gap-4">
          <Field label="Category" required>
            <Select value={category} onChange={e => setCategory(e.target.value)}>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>

          <Field label="Description">
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="e.g. June mineral block delivery — 40 bags"
            />
          </Field>

          <Field label="Total amount ($)" required>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={totalAmount}
              onChange={e => setTotalAmount(e.target.value)}
              placeholder="0.00"
            />
          </Field>

          <Field label="Expense date">
            <Input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Billing period start" helper="Optional: tie to a period">
              <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
            </Field>
            <Field label="Billing period end">
              <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
            </Field>
          </div>

          {error && (
            <p className="type-helper px-3 py-2 rounded" style={{ color: 'var(--danger-fg)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <Button type="button" intent="ghost" size="sm" onClick={onClose}>CANCEL</Button>
          <Button type="button" intent="primary" size="sm" loading={saving} onClick={handleSave} className="flex-1">
            {mode === 'edit' ? 'SAVE CHANGES' : 'ADD EXPENSE'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export type { LeaseExpense }
