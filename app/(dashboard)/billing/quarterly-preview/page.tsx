'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { ContextBanner } from '@/components/ui/ContextBanner'

interface LineItem {
  description: string
  quantity: number | null
  unit_price: number | null
  amount: number
  is_header?: boolean
  share_note?: string
  expense_type?: string
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

interface PreviewParams {
  owner_id: string
  billing_quarter: number
  billing_year: number
  expense_quarter: number
  expense_year: number
  due_date: string | null
}

const SEX_LABELS: Record<string, string> = {
  cow: 'COWS', heifer: 'HEIFERS', bull: 'BULLS', steer: 'STEERS', calf: 'CALVES',
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export default function QuarterlyPreviewPage() {
  const router = useRouter()
  const [preview,  setPreview]  = useState<InvoicePreview | null>(null)
  const [params,   setParams]   = useState<PreviewParams | null>(null)
  const [creating, setCreating] = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    const raw = sessionStorage.getItem('quarterly_preview')
    if (!raw) { router.replace('/billing'); return }
    try {
      const data = JSON.parse(raw)
      setPreview(data.preview)
      setParams(data.params)
    } catch {
      router.replace('/billing')
    }
  }, [router])

  const handleCreate = async () => {
    if (!params) return
    setCreating(true); setError('')
    try {
      const res = await fetch('/api/billing/generate-quarterly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, dry_run: false }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to create invoice'); return }
      sessionStorage.removeItem('quarterly_preview')
      router.push(`/billing/${json.invoice.id}`)
    } catch {
      setError('Connection error')
    } finally {
      setCreating(false)
    }
  }

  if (!preview || !params) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-16">
          <p style={{ color: 'var(--text-muted)' }}>Loading preview…</p>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="QUARTERLY INVOICE"
        title="REVIEW"
        actions={
          <Button intent="ghost" size="sm" onClick={() => router.push('/billing')}>
            ← BACK
          </Button>
        }
      />

      <div className="flex flex-col gap-4 pb-8">
        {/* Summary card */}
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
          <div
            className="grid text-xs font-semibold px-3 py-2"
            style={{ gridTemplateColumns: '1fr auto auto', background: 'var(--surface-2)', color: 'var(--text-muted)', gap: 8 }}
          >
            <span>DESCRIPTION</span>
            <span className="text-right">QTY</span>
            <span className="text-right">AMOUNT</span>
          </div>
          {preview.line_items.map((item, i) =>
            item.is_header ? (
              <div
                key={i}
                className="px-3 py-2 text-xs font-bold"
                style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-muted)' }}
              >
                {item.description}
              </div>
            ) : (
              <div
                key={i}
                className="grid px-3 py-3 text-sm"
                style={{ gridTemplateColumns: '1fr auto auto', gap: 8, borderTop: '1px solid var(--border)' }}
              >
                <span style={{ color: 'var(--text)' }}>{item.description}</span>
                <span className="text-right" style={{ color: 'var(--text-muted)' }}>{item.quantity ?? '—'}</span>
                <span className="text-right font-semibold" style={{ color: 'var(--gold-fg)' }}>{fmt(item.amount)}</span>
              </div>
            )
          )}
          <div
            className="flex justify-between px-3 py-3 font-bold"
            style={{ borderTop: '2px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)' }}
          >
            <span>TOTAL</span>
            <span style={{ color: 'var(--gold-fg)' }}>{fmt(preview.total)}</span>
          </div>
        </div>

        {params.due_date && (
          <p className="type-helper text-center" style={{ color: 'var(--text-muted)' }}>
            Due {new Date(params.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}

        {error && <ContextBanner tone="danger">{error}</ContextBanner>}

        <Button intent="primary" size="sm" loading={creating} onClick={handleCreate} className="w-full">
          CREATE INVOICE
        </Button>
      </div>
    </PageContainer>
  )
}
