'use client'

import { useState, useEffect } from 'react'
import { fmtDate, fmtMoney } from '@/lib/format'

/**
 * The two reports an owner asks an accountant for, and the one he asks
 * himself.
 *
 * Kept out of the portal page because that file is already long enough that
 * nobody reads to the bottom of it, and because both of these are the sort of
 * thing that grows: a report gains a column every tax year.
 */

const chip: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700,
  letterSpacing: '0.06em', cursor: 'pointer',
  background: 'var(--surface-2)', color: 'var(--text-secondary)',
  border: '1px solid var(--border)',
}

// ─── Purchases ────────────────────────────────────────────────────────────────

interface PurchaseRow {
  animal_ids: string[]
  date: string | null
  description: string
  tag: string
  cost: number | null
  seller: string | null
  incomplete: string[]
}

interface PurchaseSummary {
  purchases: number
  head: number
  total: number
  missing_price: number
}

/**
 * Every head bought: when, what, what it cost, who sold it.
 *
 * A row with a gap is shown with the gap. Filling a missing price with $0
 * would claim the animal was free, and a total that quietly skipped those rows
 * would be a wrong number wearing the clothes of a right one — so how many are
 * missing sits next to the sum.
 */
export function PurchasesReport() {
  const [rows, setRows] = useState<PurchaseRow[]>([])
  const [summary, setSummary] = useState<PurchaseSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let off = false
    fetch('/api/portals/owner/purchases', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (!off) { setRows(d.data ?? []); setSummary(d.summary ?? null) } })
      .catch(() => {})
      .finally(() => { if (!off) setLoading(false) })
    return () => { off = true }
  }, [])

  if (loading) return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>
  if (rows.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No purchases on file yet.</p>
  }

  const downloadCsv = () => {
    const header = 'Date,Description,Tag,Cost,Seller\n'
    const body = rows.map(r => [
      r.date ?? '',
      `"${r.description.replace(/"/g, '""')}"`,
      `"${r.tag}"`,
      r.cost != null ? r.cost.toFixed(2) : '',
      `"${(r.seller ?? '').replace(/"/g, '""')}"`,
    ].join(',')).join('\n')

    const url = URL.createObjectURL(new Blob([header + body], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'purchases.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map(r => (
        <div
          key={r.animal_ids.join('-')}
          style={{
            display: 'flex', alignItems: 'baseline', gap: 10,
            paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13, color: 'var(--text)' }}>
              {r.description} <span style={{ color: 'var(--text-muted)' }}>(Tag {r.tag})</span>
            </span>
            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
              {r.date ? fmtDate(r.date) : 'date not recorded'}
              {r.seller ? ` · ${r.seller}` : ' · seller not recorded'}
            </span>
          </span>
          <span style={{
            fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
            color: r.cost != null ? 'var(--text)' : 'var(--text-muted)',
          }}>
            {r.cost != null ? fmtMoney(r.cost) : '—'}
          </span>
        </div>
      ))}

      {summary && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {summary.purchases} purchase{summary.purchases === 1 ? '' : 's'} · {summary.head} head
            {summary.missing_price > 0 && (
              <span style={{ color: 'var(--warning-fg)' }}>
                {' · '}{summary.missing_price} with no price recorded
              </span>
            )}
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>
            {fmtMoney(summary.total)}
          </span>
        </div>
      )}

      <button type="button" onClick={downloadCsv} style={{ ...chip, alignSelf: 'flex-start' }}>
        DOWNLOAD CSV
      </button>
    </div>
  )
}

// ─── Schedule F ───────────────────────────────────────────────────────────────

interface ScheduleF {
  year: number
  income: { line1: number; line2: number; costBasis: number; calfShareMemo: string | null }
  expenses: Array<{ line: string; label: string; total: number }>
  unmapped: Array<{ label: string; total: number }>
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '5px 0' }}>
      <span style={{ color: muted ? 'var(--text-muted)' : 'var(--text-secondary)' }}>{label}</span>
      <span style={{ color: 'var(--text)', fontWeight: 600, whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

/**
 * The figures an accountant asks for, by Schedule F line.
 *
 * Computed by the same route the ranch uses, so an owner's copy and the
 * ranch's copy cannot disagree. The owner-facing wrapper exists only to pin
 * the owner to the session: the operator route takes owner_id from the query
 * string, which behind a portal login would be a way to read another man's
 * books.
 */
export function ScheduleFReport({ year }: { year: number }) {
  const [data, setData] = useState<ScheduleF | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let off = false
    setLoading(true)
    fetch(`/api/portals/owner/schedule-f?year=${year}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (!off && !d.error) setData(d) })
      .catch(() => {})
      .finally(() => { if (!off) setLoading(false) })
    return () => { off = true }
  }, [year])

  if (loading) return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>
  if (!data)   return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing to report for {year}.</p>

  const expenseTotal = data.expenses.reduce((s, e) => s + e.total, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
          Income — {data.year}
        </p>
        <Row label="1a — Livestock bought for resale" value={fmtMoney(data.income.line1)} />
        <Row label="1b — Cost of livestock sold"      value={fmtMoney(data.income.costBasis)} />
        <Row label="2 — Raised livestock sold"        value={fmtMoney(data.income.line2)} />
        {data.income.calfShareMemo && (
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>{data.income.calfShareMemo}</p>
        )}
      </div>

      <div>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
          Expenses
        </p>
        {data.expenses.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>None recorded.</p>
        ) : (
          <>
            {data.expenses.map(e => (
              <Row key={e.line} label={`${e.line} — ${e.label}`} value={fmtMoney(e.total)} />
            ))}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
              <Row label="Total expenses" value={fmtMoney(expenseTotal)} />
            </div>
          </>
        )}
      </div>

      {/* Costs whose category has no Schedule F line set. Shown rather than
          dropped — money that disappears between two reports is exactly what
          an accountant finds and asks about. */}
      {data.unmapped.length > 0 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--warning-fg)', textTransform: 'uppercase', marginBottom: 4 }}>
            Not yet assigned a line
          </p>
          {data.unmapped.map(u => <Row key={u.label} label={u.label} value={fmtMoney(u.total)} muted />)}
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
            Ask the ranch which line these belong on.
          </p>
        </div>
      )}
    </div>
  )
}
