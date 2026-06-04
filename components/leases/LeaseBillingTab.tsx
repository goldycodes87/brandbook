'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StatCard } from '@/components/ui/StatCard'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { Panel } from '@/components/ui/Panel'
import Badge from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AddPeriodSheet } from './AddPeriodSheet'
import { AddLeaseExpenseSheet, type LeaseExpense } from './AddLeaseExpenseSheet'
import { apiPatch, apiDelete } from '@/lib/fetch'
import type { Lease } from './LeaseSheet'

interface AumOwnerRow {
  owner_id: string | null
  owner_name: string
  billable: number
  calves_excluded: number
  percent_of_herd: number
}

interface AumData {
  total_billable_units: number
  unweaned_calves_excluded: number
  by_owner: AumOwnerRow[]
}

interface Period {
  id: string
  lease_id: string
  start_date: string
  end_date: string
  head_count: number
  animal_ids: string[] | null
  notes: string | null
  is_paid: boolean | null
  paid_date: string | null
  paid_amount: number | null
  created_at: string
  days: number
  calculated_cost: number
}

interface BillingSummary {
  total_owed: number
  total_paid: number
  total_unpaid: number
  period_count: number
  rate_used: string
}

interface Props {
  leaseId: string
  lease: Lease
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function LeaseBillingTab({ leaseId, lease }: Props) {
  const router = useRouter()
  const [periods, setPeriods]   = useState<Period[]>([])
  const [summary, setSummary]   = useState<BillingSummary | null>(null)
  const [aumData, setAumData]   = useState<AumData | null>(null)
  const [expenses, setExpenses] = useState<LeaseExpense[]>([])
  const [loading, setLoading]   = useState(true)
  const [addOpen, setAddOpen]   = useState(false)
  const [editTarget, setEditTarget] = useState<Period | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Period | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [markingPaid, setMarkingPaid] = useState<string | null>(null)
  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false)
  const [editExpense, setEditExpense] = useState<LeaseExpense | null>(null)
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null)
  const [filterYear, setFilterYear]       = useState<string>(String(new Date().getFullYear()))
  const [filterQuarter, setFilterQuarter] = useState<string>('ALL')
  const [filterType, setFilterType]       = useState<string>('ALL')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const expParams = new URLSearchParams()
      if (filterYear)              expParams.set('year', String(Number(filterYear) % 100))
      if (filterQuarter !== 'ALL') expParams.set('quarter', filterQuarter)
      if (filterType    !== 'ALL') expParams.set('expense_type', filterType.toLowerCase())

      const [billingRes, aumRes, expRes] = await Promise.all([
        fetch(`/api/leases/${leaseId}/billing`),
        fetch(`/api/leases/${leaseId}/aum`),
        fetch(`/api/leases/${leaseId}/expenses?${expParams}`),
      ])
      const billing = await billingRes.json()
      const aum     = await aumRes.json()
      const exp     = await expRes.json()
      setPeriods(billing.periods ?? [])
      setSummary(billing.summary ?? null)
      if (!aum.error) setAumData(aum)
      setExpenses(exp.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [leaseId])

  const handleDeleteExpense = async (id: string) => {
    setDeletingExpenseId(id)
    try {
      await fetch(`/api/leases/${leaseId}/expenses/${id}`, { method: 'DELETE' })
      load()
    } finally {
      setDeletingExpenseId(null)
    }
  }

  useEffect(() => { load() }, [load, filterYear, filterQuarter, filterType])

  const handleMarkPaid = async (p: Period) => {
    setMarkingPaid(p.id)
    try {
      const res = await apiPatch(`/api/leases/${leaseId}/periods/${p.id}`, {
        is_paid: true,
        paid_date: new Date().toISOString().slice(0, 10),
        paid_amount: p.calculated_cost,
      })
      if (res.ok) load()
    } finally {
      setMarkingPaid(null) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await apiDelete(`/api/leases/${leaseId}/periods/${deleteTarget.id}`)
      if (res.ok) { load(); setDeleteTarget(null) }
    } finally { setDeleting(false) }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3 mt-4">
        {[1,2,3].map(i => <div key={i} className="h-24 rounded-lg animate-pulse" style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }} />)}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 mt-4">

      {/* ── Summary cards ─────────────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Owed" value={fmt(summary.total_owed)} valueColor="var(--gold-fg)" />
          <StatCard label="Total Paid" value={fmt(summary.total_paid)} valueColor="var(--success-fg, #22c55e)" />
          <StatCard
            label="Balance Due"
            value={fmt(summary.total_unpaid)}
            valueColor={summary.total_unpaid > 0 ? 'var(--danger-fg)' : undefined}
          />
          <StatCard label="Periods" value={String(summary.period_count)} />
        </div>
      )}

      {/* ── Rate banner ───────────────────────────────────────────────── */}
      {summary && (
        <ContextBanner tone="neutral" title={`Rate: ${summary.rate_used}`} />
      )}

      {/* ── Herd composition ──────────────────────────────────────────── */}
      {aumData && aumData.by_owner.length > 0 && (
        <Panel
          title="HERD COMPOSITION"
          subtitle={`${aumData.total_billable_units} billable units${aumData.unweaned_calves_excluded > 0 ? ` · ${aumData.unweaned_calves_excluded} unweaned calves excluded` : ''}`}
          padding="none"
        >
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                  {['Owner', 'Billable Head', 'Calves (excluded)', '% of Herd', ''].map(h => (
                    <th key={h} className="text-left px-4 py-2 type-helper font-semibold" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aumData.by_owner.map((row, i) => (
                  <tr key={row.owner_id ?? 'unassigned'} style={{ borderBottom: i < aumData.by_owner.length - 1 ? '1px solid var(--border)' : undefined }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text)' }}>{row.owner_name}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text)' }}>{row.billable}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{row.calves_excluded > 0 ? row.calves_excluded : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 rounded-full flex-1 max-w-[80px]" style={{ background: 'var(--surface-2)' }}>
                          <div className="h-full rounded-full" style={{ width: `${row.percent_of_herd}%`, background: 'var(--accent)' }} />
                        </div>
                        <span className="type-helper font-semibold" style={{ color: 'var(--text)' }}>{row.percent_of_herd}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {row.owner_id && (
                        <Button
                          intent="ghost" size="sm"
                          onClick={() => router.push(`/billing?new=1&owner_id=${row.owner_id}&head_count=${row.billable}`)}
                        >
                          APPLY TO INVOICE
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden flex flex-col">
            {aumData.by_owner.map((row, i) => (
              <div
                key={row.owner_id ?? 'unassigned'}
                className="px-4 py-4"
                style={{ borderBottom: i < aumData.by_owner.length - 1 ? '1px solid var(--border)' : undefined }}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>{row.owner_name}</p>
                  <span className="type-helper font-bold" style={{ color: 'var(--accent)' }}>{row.percent_of_herd}%</span>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-xl font-bold" style={{ color: 'var(--text)' }}>{row.billable}</span>
                    <span className="type-helper ml-1" style={{ color: 'var(--text-muted)' }}>billable</span>
                  </div>
                  {row.calves_excluded > 0 && (
                    <span className="type-helper" style={{ color: 'var(--text-muted)' }}>+{row.calves_excluded} calves</span>
                  )}
                </div>
                {row.owner_id && (
                  <Button
                    intent="ghost" size="sm" className="mt-3"
                    onClick={() => router.push(`/billing?new=1&owner_id=${row.owner_id}&head_count=${row.billable}`)}
                  >
                    APPLY TO INVOICE
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ── Grazing periods ───────────────────────────────────────────── */}
      <Panel
        title="GRAZING PERIODS"
        subtitle="Head counts by date range"
        actions={
          <Button intent="primary" size="sm" onClick={() => { setEditTarget(null); setAddOpen(true) }}>
            <Plus size={14} className="mr-1" />
            ADD PERIOD
          </Button>
        }
        padding="none"
      >
        {periods.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="type-helper" style={{ color: 'var(--text-muted)' }}>No grazing periods yet.</p>
            <Button intent="primary" size="sm" className="mt-3" onClick={() => setAddOpen(true)}>
              Add First Period
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                    {['Start','End','Days','Animals','Cost','Status',''].map(h => (
                      <th key={h} className="text-left px-4 py-2 type-helper font-semibold" style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: i < periods.length - 1 ? '1px solid var(--border)' : undefined }}>
                      <td className="px-4 py-3" style={{ color: 'var(--text)' }}>{fmtDate(p.start_date)}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text)' }}>{fmtDate(p.end_date)}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{p.days}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text)' }}>
                        {p.animal_ids?.length
                          ? <span className="inline-flex items-center gap-1">
                              <span>{p.animal_ids.length}</span>
                              <span className="type-helper" style={{ color: 'var(--text-muted)' }}>tracked</span>
                            </span>
                          : p.head_count}
                      </td>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--gold-fg)' }}>{fmt(p.calculated_cost)}</td>
                      <td className="px-4 py-3">
                        {p.is_paid
                          ? <Badge variant="success">PAID</Badge>
                          : <Badge variant="warning">UNPAID</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {!p.is_paid && (
                            <Button
                              intent="ghost" size="sm"
                              loading={markingPaid === p.id}
                              onClick={() => handleMarkPaid(p)}
                            >MARK PAID</Button>
                          )}
                          <button type="button" onClick={() => { setEditTarget(p); setAddOpen(true) }}>
                            <Pencil size={14} style={{ color: 'var(--text-muted)' }} />
                          </button>
                          <button type="button" onClick={() => setDeleteTarget(p)}>
                            <Trash2 size={14} style={{ color: 'var(--danger-fg)' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden flex flex-col">
              {periods.map((p, i) => (
                <div
                  key={p.id}
                  className="px-4 py-4"
                  style={{ borderBottom: i < periods.length - 1 ? '1px solid var(--border)' : undefined }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                        {fmtDate(p.start_date)} – {fmtDate(p.end_date)}
                      </p>
                      <p className="type-helper" style={{ color: 'var(--text-muted)' }}>{p.days} days</p>
                    </div>
                    {p.is_paid
                      ? <Badge variant="success">PAID</Badge>
                      : <Badge variant="warning">UNPAID</Badge>}
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
                        {p.animal_ids?.length ?? p.head_count}
                      </span>
                      <span className="type-helper ml-1" style={{ color: 'var(--text-muted)' }}>
                        {p.animal_ids?.length ? 'tracked' : 'head'}
                      </span>
                    </div>
                    <span className="text-base font-semibold" style={{ color: 'var(--gold-fg)' }}>{fmt(p.calculated_cost)}</span>
                  </div>
                  {p.notes && <p className="type-helper mt-1" style={{ color: 'var(--text-muted)' }}>{p.notes}</p>}
                  <div className="flex items-center gap-2 mt-3">
                    {!p.is_paid && (
                      <Button
                        intent="ghost" size="sm"
                        loading={markingPaid === p.id}
                        onClick={() => handleMarkPaid(p)}
                      >MARK PAID</Button>
                    )}
                    <Button intent="ghost" size="sm" onClick={() => { setEditTarget(p); setAddOpen(true) }}>EDIT</Button>
                    <button type="button" className="ml-auto" onClick={() => setDeleteTarget(p)}>
                      <Trash2 size={16} style={{ color: 'var(--danger-fg)' }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals footer */}
            {summary && (
              <div
                className="flex flex-col gap-1 px-5 py-4"
                style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}
              >
                <div className="flex justify-between">
                  <span className="type-helper font-semibold" style={{ color: 'var(--text-muted)' }}>TOTAL</span>
                  <span className="font-bold text-base" style={{ color: 'var(--gold-fg)' }}>{fmt(summary.total_owed)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="type-helper" style={{ color: 'var(--text-muted)' }}>Paid</span>
                  <span className="type-helper font-medium" style={{ color: 'var(--success-fg, #22c55e)' }}>{fmt(summary.total_paid)}</span>
                </div>
                {summary.total_unpaid > 0 && (
                  <div className="flex justify-between">
                    <span className="type-helper font-semibold" style={{ color: 'var(--danger-fg)' }}>Balance Due</span>
                    <span className="type-helper font-bold" style={{ color: 'var(--danger-fg)' }}>{fmt(summary.total_unpaid)}</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Panel>

      {/* ── Lease expenses ────────────────────────────────────────────── */}

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterYear}
          onChange={e => setFilterYear(e.target.value)}
          className="text-sm rounded px-2 py-1"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', color: 'var(--text)' }}
        >
          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>

        <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {['ALL','1','2','3','4'].map(q => (
            <button
              key={q}
              type="button"
              onClick={() => setFilterQuarter(q)}
              className="px-3 py-1 text-xs font-semibold transition-colors"
              style={{
                background: filterQuarter === q ? 'var(--accent)' : 'var(--surface-1)',
                color:      filterQuarter === q ? 'var(--accent-fg, #fff)' : 'var(--text-muted)',
                borderRight: q !== '4' ? '1px solid var(--border)' : undefined,
              }}
            >
              {q === 'ALL' ? 'ALL Q' : `Q${q}`}
            </button>
          ))}
        </div>

        <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {(['ALL','SHARED','OWNER','ANIMAL'] as const).map((t, idx, arr) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilterType(t)}
              className="px-3 py-1 text-xs font-semibold transition-colors"
              style={{
                background: filterType === t ? 'var(--accent)' : 'var(--surface-1)',
                color:      filterType === t ? 'var(--accent-fg, #fff)' : 'var(--text-muted)',
                borderRight: idx < arr.length - 1 ? '1px solid var(--border)' : undefined,
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="ml-auto">
          <Button intent="primary" size="sm" onClick={() => { setEditExpense(null); setExpenseSheetOpen(true) }}>
            <Plus size={14} className="mr-1" />
            LOG EXPENSE
          </Button>
        </div>
      </div>

      <Panel
        title="LEASE EXPENSES"
        subtitle="Logged expenses for this lease"
        padding="none"
      >
        {expenses.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
              No expenses logged. Expenses are split by herd % or assigned to a specific owner or animal when generating invoices.
            </p>
            <Button intent="primary" size="sm" className="mt-3" onClick={() => setExpenseSheetOpen(true)}>
              Log First Expense
            </Button>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                    {['Date', 'Type', 'Category', 'Description', 'Total Amount', ''].map(h => (
                      <th key={h} className="text-left px-4 py-2 type-helper font-semibold" style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp, i) => (
                    <tr key={exp.id} style={{ borderBottom: i < expenses.length - 1 ? '1px solid var(--border)' : undefined }}>
                      <td className="px-4 py-3 type-helper" style={{ color: 'var(--text-muted)' }}>
                        {exp.expense_date ? fmtDate(exp.expense_date) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="type-helper font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
                          {exp.expense_type === 'owner_specific' ? 'Owner' : exp.expense_type === 'animal_specific' ? 'Animal' : 'Shared'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--text)' }}>{exp.category_name}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{exp.description || '—'}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: 'var(--gold-fg)' }}>{fmt(exp.total_amount)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => { setEditExpense(exp); setExpenseSheetOpen(true) }}>
                            <Pencil size={14} style={{ color: 'var(--text-muted)' }} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(exp.id)}
                            disabled={deletingExpenseId === exp.id}
                          >
                            <Trash2 size={14} style={{ color: 'var(--danger-fg)', opacity: deletingExpenseId === exp.id ? 0.5 : 1 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden flex flex-col">
              {expenses.map((exp, i) => (
                <div
                  key={exp.id}
                  className="px-4 py-4"
                  style={{ borderBottom: i < expenses.length - 1 ? '1px solid var(--border)' : undefined }}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{exp.category_name}</p>
                        <span className="type-helper uppercase" style={{ color: 'var(--text-muted)' }}>
                          {exp.expense_type === 'owner_specific' ? 'Owner' : exp.expense_type === 'animal_specific' ? 'Animal' : 'Shared'}
                        </span>
                      </div>
                      {exp.description && <p className="type-helper" style={{ color: 'var(--text-muted)' }}>{exp.description}</p>}
                    </div>
                    <span className="font-bold text-sm" style={{ color: 'var(--gold-fg)' }}>{fmt(exp.total_amount)}</span>
                  </div>
                  {exp.expense_date && <p className="type-helper" style={{ color: 'var(--text-muted)' }}>{fmtDate(exp.expense_date)}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <Button intent="ghost" size="sm" onClick={() => { setEditExpense(exp); setExpenseSheetOpen(true) }}>EDIT</Button>
                    <button type="button" className="ml-auto" onClick={() => handleDeleteExpense(exp.id)}>
                      <Trash2 size={16} style={{ color: 'var(--danger-fg)' }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total footer */}
            <div
              className="px-5 py-3 flex justify-between"
              style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}
            >
              <span className="type-helper font-semibold" style={{ color: 'var(--text-muted)' }}>TOTAL EXPENSES</span>
              <span className="font-bold" style={{ color: 'var(--gold-fg)' }}>
                {fmt(expenses.reduce((s, e) => s + e.total_amount, 0))}
              </span>
            </div>
          </>
        )}
      </Panel>

      <AddPeriodSheet
        isOpen={addOpen}
        onClose={() => { setAddOpen(false); setEditTarget(null) }}
        leaseId={leaseId}
        lease={lease}
        onSuccess={load}
        initialData={editTarget}
        mode={editTarget ? 'edit' : 'create'}
      />

      <AddLeaseExpenseSheet
        isOpen={expenseSheetOpen}
        onClose={() => { setExpenseSheetOpen(false); setEditExpense(null) }}
        leaseId={leaseId}
        leaseName={lease.property_name}
        onSuccess={load}
        initialData={editExpense}
        mode={editExpense ? 'edit' : 'create'}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete period?"
        message={deleteTarget ? `Remove the period ${fmtDate(deleteTarget.start_date)} – ${fmtDate(deleteTarget.end_date)}? This cannot be undone.` : ''}
        confirmLabel="DELETE PERIOD"
        loading={deleting}
      />
    </div>
  )
}
