'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, DollarSign, Send, CheckCircle } from 'lucide-react'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Button } from '@/components/ui/Button'
import { ContextBanner } from '@/components/ui/ContextBanner'
import Badge from '@/components/ui/Badge'
import { apiGet } from '@/lib/fetch'

type Status = 'pending' | 'invoiced' | 'paid'

interface AllocationRow {
  expense_id: string
  owner_id: string | null
  owner_name: string
  description: string
  category_name: string | null
  expense_date: string | null
  lease_name: string | null
  kind: 'owner_specific' | 'animal_specific' | 'shared'
  expense_total: number
  amount: number
  share_note: string | null
  status: Status
  invoice_id: string | null
  invoice_number: string | null
}

interface OwnerSummary {
  owner_id: string | null
  owner_name: string
  pending: number
  invoiced: number
  paid: number
  total: number
}

interface Report {
  quarter: number
  year: number
  period: { start: string; end: string }
  rows: AllocationRow[]
  owners: OwnerSummary[]
  totals: { pending: number; invoiced: number; paid: number; total: number }
  unallocated: Array<{ expense_id: string; description: string; amount: number; reason: string }>
}

const STATUS_VARIANT: Record<Status, 'warning' | 'info' | 'success'> = {
  pending: 'warning', invoiced: 'info', paid: 'success',
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ExpenseAllocationsPage() {
  const router = useRouter()
  const now = new Date()

  const [year,    setYear]    = useState(now.getFullYear() % 100)
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3))
  const [ownerFilter, setOwnerFilter] = useState<string>('all')

  // Keyed by the period it describes, so `loading` is derived rather than
  // toggled — no synchronous setState in the effect, and a stale response for
  // a period the user has already clicked away from can never be shown.
  const periodKey = `${year}-${quarter}`
  const [result, setResult] = useState<{ key: string; report: Report | null; error: string } | null>(null)

  const loading = result?.key !== periodKey
  const report  = result?.key === periodKey ? result.report : null
  const error   = result?.key === periodKey ? result.error  : ''

  useEffect(() => {
    let cancelled = false
    apiGet(`/api/expenses/allocations?year=${year}&quarter=${quarter}`)
      .then(async res => ({ ok: res.ok, json: await res.json() }))
      .then(({ ok, json }) => {
        if (cancelled) return
        setResult(ok
          ? { key: periodKey, report: json, error: '' }
          : { key: periodKey, report: null, error: json.error ?? 'Failed to load allocations' })
      })
      .catch(() => {
        if (!cancelled) setResult({ key: periodKey, report: null, error: 'Connection error' })
      })
    return () => { cancelled = true }
  }, [year, quarter, periodKey])

  const rows = (report?.rows ?? []).filter(r =>
    ownerFilter === 'all' || (r.owner_id ?? 'ranch') === ownerFilter
  )

  // One block per expense, owners nested inside — the question being answered
  // is "who owes what on this expense", not "list every share".
  const byExpense = new Map<string, AllocationRow[]>()
  for (const r of rows) {
    const list = byExpense.get(r.expense_id) ?? []
    list.push(r)
    byExpense.set(r.expense_id, list)
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="BILLING"
        title="EXPENSE SHARES"
        subtitle={report ? `Q${report.quarter} 20${String(report.year).padStart(2, '0')} · ${report.rows.length} share${report.rows.length !== 1 ? 's' : ''}` : undefined}
        actions={
          <Button intent="ghost" size="sm" onClick={() => router.push('/billing')}>
            ← BACK
          </Button>
        }
      />

      {/* Period picker */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[1, 2, 3, 4].map(q => (
          <Button
            key={q}
            intent={q === quarter ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setQuarter(q)}
          >
            Q{q}
          </Button>
        ))}
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="rounded-lg px-3 py-1.5 text-sm"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
        >
          {[now.getFullYear() % 100, (now.getFullYear() % 100) - 1, (now.getFullYear() % 100) - 2].map(y => (
            <option key={y} value={y}>20{String(y).padStart(2, '0')}</option>
          ))}
        </select>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard
          label="PENDING"
          value={fmt(report?.totals.pending ?? 0)}
          meta="not yet invoiced"
          valueColor="var(--gold-fg, #d97706)"
          aside={<DollarSign size={16} style={{ color: 'var(--text-muted)' }} />}
        />
        <StatCard
          label="INVOICED"
          value={fmt(report?.totals.invoiced ?? 0)}
          meta="billed, awaiting payment"
          aside={<Send size={16} style={{ color: 'var(--text-muted)' }} />}
        />
        <StatCard
          label="PAID"
          value={fmt(report?.totals.paid ?? 0)}
          valueColor="var(--success-fg)"
          aside={<CheckCircle size={16} style={{ color: 'var(--text-muted)' }} />}
        />
        <StatCard
          label="QUARTER TOTAL"
          value={fmt(report?.totals.total ?? 0)}
          meta={report ? `${report.period.start} → ${report.period.end}` : undefined}
        />
      </div>

      {error && <ContextBanner tone="danger">{error}</ContextBanner>}

      {report && report.unallocated.length > 0 && (
        <div className="mb-4">
          <ContextBanner tone="warning">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  {report.unallocated.length} expense{report.unallocated.length !== 1 ? 's' : ''} in nobody&apos;s column
                </p>
                {report.unallocated.map(u => (
                  <p key={u.expense_id} className="type-helper">
                    {u.description} — {fmt(u.amount)} ({u.reason})
                  </p>
                ))}
              </div>
            </div>
          </ContextBanner>
        </div>
      )}

      {/* Per-owner roll-up, doubles as the filter */}
      {report && report.owners.length > 0 && (
        <div className="flex flex-col gap-2 mb-5">
          <button
            onClick={() => setOwnerFilter('all')}
            className="rounded-lg px-4 py-2 text-left text-sm"
            style={{
              background: ownerFilter === 'all' ? 'var(--surface-2)' : 'transparent',
              border: `1px solid ${ownerFilter === 'all' ? 'var(--border)' : 'var(--border-subtle)'}`,
              color: 'var(--text)',
            }}
          >
            All owners
          </button>
          {report.owners.map(o => {
            const key = o.owner_id ?? 'ranch'
            const active = ownerFilter === key
            return (
              <button
                key={key}
                onClick={() => setOwnerFilter(active ? 'all' : key)}
                className="rounded-lg px-4 py-3 text-left"
                style={{
                  background: active ? 'var(--surface-2)' : 'var(--surface-1)',
                  border: `1px solid ${active ? 'var(--border)' : 'var(--border-subtle)'}`,
                }}
              >
                <div className="flex justify-between items-baseline gap-3">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{o.owner_name}</span>
                  <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>{fmt(o.total)}</span>
                </div>
                <div className="flex flex-wrap gap-3 mt-1 type-helper" style={{ color: 'var(--text-muted)' }}>
                  <span>Pending {fmt(o.pending)}</span>
                  <span>Invoiced {fmt(o.invoiced)}</span>
                  <span>Paid {fmt(o.paid)}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {loading && (
        <p className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Loading shares…</p>
      )}

      {!loading && report && byExpense.size === 0 && (
        <p className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
          No expenses recorded for this quarter.
        </p>
      )}

      {/* Expenses, each with its owners' shares */}
      <div className="flex flex-col gap-3 pb-8">
        {[...byExpense.entries()].map(([expenseId, shares]) => {
          const head = shares[0]
          return (
            <div
              key={expenseId}
              className="rounded-lg overflow-hidden"
              style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-1)' }}
            >
              <div className="px-4 py-3" style={{ background: 'var(--surface-2)' }}>
                <div className="flex justify-between items-baseline gap-3">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    {head.description}
                  </span>
                  <span className="text-sm font-bold whitespace-nowrap" style={{ color: 'var(--gold-fg, #d97706)' }}>
                    {fmt(head.expense_total)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mt-1 type-helper" style={{ color: 'var(--text-muted)' }}>
                  <span>{fmtDate(head.expense_date)}</span>
                  {head.category_name && <span>· {head.category_name}</span>}
                  {head.lease_name && <span>· {head.lease_name}</span>}
                  <span>· {head.kind === 'shared' ? 'split by herd-days' : 'single owner'}</span>
                </div>
              </div>

              {shares.map(s => (
                <div
                  key={`${s.expense_id}-${s.owner_id ?? 'ranch'}`}
                  className="px-4 py-3 flex justify-between items-center gap-3"
                  style={{ borderTop: '1px solid var(--border-subtle)' }}
                >
                  <div className="min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--text)' }}>{s.owner_name}</p>
                    {s.share_note && (
                      <p className="type-helper" style={{ color: 'var(--text-muted)' }}>{s.share_note}</p>
                    )}
                    {s.invoice_number && (
                      <button
                        onClick={() => s.invoice_id && router.push(`/billing/${s.invoice_id}`)}
                        className="type-helper underline"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Invoice {s.invoice_number}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge variant={STATUS_VARIANT[s.status]}>{s.status.toUpperCase()}</Badge>
                    <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{fmt(s.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </PageContainer>
  )
}
