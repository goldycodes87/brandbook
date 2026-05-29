'use client'

import { useState, useEffect } from 'react'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Panel } from '@/components/ui/Panel'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'

interface SaleRow {
  id: string
  sale_date: string | null
  buyer: string | null
  destination: string | null
  sale_weight_lbs: number | null
  price_per_lb: number | null
  gross_proceeds: number | null
  notes: string | null
  animal: { tag_number: string; name: string | null } | null
}

function fmt(v: number | null, prefix = ''): string {
  if (v == null) return '—'
  return prefix + v.toLocaleString()
}

export default function SalesPage() {
  const [sales, setSales]     = useState<SaleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal]     = useState(0)

  useEffect(() => {
    fetch('/api/sales')
      .then(r => r.json())
      .then(d => {
        const rows = d.data ?? d ?? []
        setSales(rows)
        setTotal(rows.reduce((s: number, r: SaleRow) => s + (r.gross_proceeds ?? 0), 0))
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <PageContainer>
      <PageHeader
        title="Sales"
        subtitle={!loading && sales.length > 0 ? `${sales.length} sale${sales.length !== 1 ? 's' : ''} · $${total.toLocaleString()} total proceeds` : undefined}
      />

      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : sales.length === 0 ? (
        <EmptyState
          variant="neutral"
          title="No sales recorded"
          body="Use the SELL button on any animal detail page to record a sale."
        />
      ) : (
        <Panel padding="none">
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Animal</TH>
                <TH>Destination</TH>
                <TH>Buyer</TH>
                <TH>Weight</TH>
                <TH>$/lb</TH>
                <TH>Proceeds</TH>
              </TR>
            </THead>
            <TBody>
              {sales.map(s => (
                <TR key={s.id}>
                  <TD>{s.sale_date ? new Date(s.sale_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</TD>
                  <TD>
                    {s.animal ? (
                      <span>
                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>#{s.animal.tag_number}</span>
                        {s.animal.name && <span className="ml-1.5" style={{ color: 'var(--text-muted)' }}>{s.animal.name}</span>}
                      </span>
                    ) : '—'}
                  </TD>
                  <TD>{s.destination ?? '—'}</TD>
                  <TD>{s.buyer ?? '—'}</TD>
                  <TD>{fmt(s.sale_weight_lbs)} {s.sale_weight_lbs ? 'lbs' : ''}</TD>
                  <TD>{s.price_per_lb != null ? `$${s.price_per_lb.toFixed(3)}` : '—'}</TD>
                  <TD style={{ color: 'var(--success-fg)', fontWeight: 600 }}>
                    {s.gross_proceeds != null ? `$${s.gross_proceeds.toLocaleString()}` : '—'}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Panel>
      )}
    </PageContainer>
  )
}
