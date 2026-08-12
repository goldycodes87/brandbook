'use client'

import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/fetch'
import { Panel } from '@/components/ui/Panel'
import { Skeleton } from '@/components/ui/Skeleton'

interface ExpenseItem {
  id: string
  category_name: string | null
  description: string | null
  amount: number
  expense_date: string | null
  expense_type: string | null
  status: 'pending' | 'invoiced' | 'paid'
  invoice: { id: string; invoice_number: string | null; status: string | null } | null
  in_year: boolean
}

interface Payload {
  year: number
  direct_expenses: ExpenseItem[]
  total_ytd: number
  invoiced_ytd: number
  paid_ytd: number
  pending_ytd: number
  note?: string
}

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

const shortDate = (d: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'

const STATUS_STYLE: Record<ExpenseItem['status'], { label: string; fg: string; bg: string }> = {
  paid:     { label: 'PAID',     fg: 'var(--success-fg)', bg: 'var(--success-bg)' },
  invoiced: { label: 'INVOICED', fg: 'var(--info-fg)',    bg: 'var(--info-bg)' },
  pending:  { label: 'PENDING',  fg: 'var(--warning-fg)', bg: 'var(--warning-bg)' },
}

export function ExpenseHistory({ animalId }: { animalId: string }) {
  const [data,    setData]    = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [year,    setYear]    = useState(new Date().getFullYear())

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError('')
    apiGet(`/api/animals/${animalId}/expenses?year=${year}`)
      .then(async r => {
        if (!r.ok) throw new Error(r.status === 401 ? 'Session expired' : `Error ${r.status}`)
        return r.json()
      })
      .then(d => { if (!cancelled) setData(d) })
      .catch(e => { if (!cancelled) setError(e.message || 'Could not load expenses') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [animalId, year])

  const rows = data?.direct_expenses.filter(e => e.in_year) ?? []
  const thisYear = new Date().getFullYear()

  return (
    <Panel>
      <div className="flex items-center justify-between mb-3">
        <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>EXPENSE HISTORY</p>
        <div className="flex gap-1">
          {[thisYear, thisYear - 1].map(y => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              className="px-2.5 py-1 rounded-full text-xs font-bold"
              style={{
                border:     `1.5px solid ${year === y ? 'var(--accent)' : 'var(--border)'}`,
                background: year === y ? 'var(--accent-soft)' : 'var(--surface-1)',
                color:      year === y ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {loading && <Skeleton />}

      {!loading && error && (
        <p className="type-helper px-3 py-2 rounded" style={{ color: 'var(--danger-fg)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
          {error}
        </p>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
          No direct expenses recorded for {year}.
        </p>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          <div className="flex flex-col gap-1.5">
            {rows.map(e => {
              const s = STATUS_STYLE[e.status]
              return (
                <div
                  key={e.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                  style={{ border: '1px solid var(--border)', background: 'var(--surface-1)' }}
                >
                  <span className="type-helper font-mono" style={{ color: 'var(--text-muted)', minWidth: 52 }}>
                    {shortDate(e.expense_date)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                      {e.category_name ?? 'Expense'}
                    </p>
                    {e.description && (
                      <p className="type-helper truncate" style={{ color: 'var(--text-muted)' }}>{e.description}</p>
                    )}
                  </div>
                  <span className="text-sm font-bold whitespace-nowrap" style={{ color: 'var(--text)' }}>
                    {money(e.amount)}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
                    style={{ color: s.fg, background: s.bg }}
                    title={e.invoice?.invoice_number ? `Invoice #${e.invoice.invoice_number}` : undefined}
                  >
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="mt-3 pt-3 flex flex-col gap-1" style={{ borderTop: '1px solid var(--border)' }}>
            <Row label={`${year} total`}   value={money(data!.total_ytd)} bold />
            <Row label="Paid"              value={money(data!.paid_ytd)} />
            <Row label="Invoiced, unpaid"  value={money(data!.invoiced_ytd)} />
            <Row label="Not yet invoiced"  value={money(data!.pending_ytd)} />
          </div>
        </>
      )}

      {!loading && !error && data?.note && (
        <p className="type-helper mt-3" style={{ color: 'var(--text-muted)' }}>{data.note}</p>
      )}
    </Panel>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className={bold ? 'text-sm font-bold' : 'text-sm'} style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  )
}
