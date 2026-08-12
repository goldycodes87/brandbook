'use client'

import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/fetch'
import { Panel } from '@/components/ui/Panel'
import { Skeleton } from '@/components/ui/Skeleton'

interface Payload {
  year: number
  costs:   { breeding: number; direct_expenses: number; grazing: number; total: number }
  revenue: { calf_sales: number; own_sale: number; total: number }
  net: number
  calves_sold: number
  note?: string
}

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function AnnualPL({ animalId }: { animalId: string }) {
  const [data,    setData]    = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [year,    setYear]    = useState(new Date().getFullYear())

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError('')
    apiGet(`/api/animals/${animalId}/annual-pl?year=${year}`)
      .then(async r => {
        if (!r.ok) throw new Error(r.status === 401 ? 'Session expired' : `Error ${r.status}`)
        return r.json()
      })
      .then(d => { if (!cancelled) setData(d) })
      .catch(e => { if (!cancelled) setError(e.message || 'Could not load') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [animalId, year])

  const thisYear = new Date().getFullYear()
  const net = data?.net ?? 0
  const netColor = net > 0 ? 'var(--success-fg)' : net < 0 ? 'var(--danger-fg)' : 'var(--text)'

  return (
    <Panel>
      <div className="flex items-center justify-between mb-3">
        <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>ANNUAL PROFIT &amp; LOSS</p>
        <div className="flex gap-1">
          {[thisYear, thisYear - 1, thisYear - 2].map(y => (
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

      {!loading && !error && data && (
        <>
          <div
            className="rounded-xl px-4 py-3 mb-3 flex items-baseline justify-between"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{data.year} net</span>
            <span className="text-2xl font-bold" style={{ color: netColor }}>
              {net >= 0 ? '' : '−'}{money(Math.abs(net))}
            </span>
          </div>

          <p className="type-section-label mb-1" style={{ color: 'var(--text-muted)' }}>REVENUE</p>
          <Row label={`Calf sales${data.calves_sold ? ` (${data.calves_sold})` : ''}`} value={money(data.revenue.calf_sales)} />
          {data.revenue.own_sale > 0 && <Row label="Her own sale" value={money(data.revenue.own_sale)} />}
          <Row label="Total revenue" value={money(data.revenue.total)} bold />

          <p className="type-section-label mt-3 mb-1" style={{ color: 'var(--text-muted)' }}>COSTS</p>
          <Row label="Grazing"          value={money(data.costs.grazing)} />
          <Row label="Breeding"         value={money(data.costs.breeding)} />
          <Row label="Direct expenses"  value={money(data.costs.direct_expenses)} />
          <Row label="Total costs"      value={money(data.costs.total)} bold />

          {data.note && (
            <p className="type-helper mt-3" style={{ color: 'var(--text-muted)' }}>{data.note}</p>
          )}
        </>
      )}
    </Panel>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className={bold ? 'text-sm font-bold' : 'text-sm'} style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  )
}
