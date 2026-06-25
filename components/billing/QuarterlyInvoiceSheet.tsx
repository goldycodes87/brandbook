'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { Field, Input } from '@/components/ui/Field'

interface GrazingOwner {
  id: string
  name: string
  company_name: string | null
  owner_name: string | null
  email: string | null
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (invoice: { id: string }) => void
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

export function QuarterlyInvoiceSheet({ isOpen, onClose }: Props) {
  const router = useRouter()
  const [owners,   setOwners]   = useState<GrazingOwner[]>([])
  const [ownerId,  setOwnerId]  = useState('')
  const [billingQ, setBillingQ] = useState(currentQuarter())
  const [billingY, setBillingY] = useState(currentYear())
  const [expenseQ, setExpenseQ] = useState(prevQuarter(currentQuarter(), currentYear()).q)
  const [expenseY, setExpenseY] = useState(prevQuarter(currentQuarter(), currentYear()).y)
  const [dueDate,  setDueDate]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    if (!isOpen) {
      setOwnerId(''); setError('')
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
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/billing/generate-quarterly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_id:        ownerId,
          billing_quarter: billingQ,
          billing_year:    billingY,
          expense_quarter: expenseQ,
          expense_year:    expenseY,
          due_date:        dueDate || null,
          dry_run:         true,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Preview failed'); return }
      sessionStorage.setItem('quarterly_preview', JSON.stringify({
        preview: json.preview,
        params: {
          owner_id:        ownerId,
          billing_quarter: billingQ,
          billing_year:    billingY,
          expense_quarter: expenseQ,
          expense_year:    expenseY,
          due_date:        dueDate || null,
        },
      }))
      onClose()
      router.push('/billing/quarterly-preview')
    } catch {
      setError('Connection error')
    } finally {
      setLoading(false)
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
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }}
        >
          <div>
            <p className="type-helper font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              QUARTERLY INVOICE
            </p>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
              Select Owner & Period
            </h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full" style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-5 py-4 flex flex-col gap-4" style={{ overflowY: 'auto' }}>
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

          <Field label="Due Date (optional)">
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </Field>

          {error && <ContextBanner tone="danger">{error}</ContextBanner>}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex justify-end" style={{ borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <Button intent="primary" size="sm" loading={loading} onClick={handlePreview}>
            PREVIEW <ChevronRight size={14} className="ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}
