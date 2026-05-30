'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StatCard } from '@/components/ui/StatCard'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { Panel } from '@/components/ui/Panel'
import Badge from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AddPeriodSheet } from './AddPeriodSheet'
import { apiPatch, apiDelete } from '@/lib/fetch'
import type { Lease } from './LeaseSheet'

interface Period {
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
  const [periods, setPeriods]   = useState<Period[]>([])
  const [summary, setSummary]   = useState<BillingSummary | null>(null)
  const [loading, setLoading]   = useState(true)
  const [addOpen, setAddOpen]   = useState(false)
  const [editTarget, setEditTarget] = useState<Period | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Period | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [markingPaid, setMarkingPaid] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/leases/${leaseId}/billing`)
      const json = await res.json()
      setPeriods(json.periods ?? [])
      setSummary(json.summary ?? null)
    } finally {
      setLoading(false)
    }
  }, [leaseId])

  useEffect(() => { load() }, [load])

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
                    {['Start','End','Days','Head','Cost','Status',''].map(h => (
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
                      <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text)' }}>{p.head_count}</td>
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
                      <span className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{p.head_count}</span>
                      <span className="type-helper ml-1" style={{ color: 'var(--text-muted)' }}>head</span>
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

      <AddPeriodSheet
        isOpen={addOpen}
        onClose={() => { setAddOpen(false); setEditTarget(null) }}
        leaseId={leaseId}
        lease={lease}
        onSuccess={load}
        initialData={editTarget}
        mode={editTarget ? 'edit' : 'create'}
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
