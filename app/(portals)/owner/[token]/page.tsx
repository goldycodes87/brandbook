'use client'

import { useState, useEffect, use } from 'react'
import Badge from '@/components/ui/Badge'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { EmptyState } from '@/components/ui/EmptyState'

// ─── Types ─────────────────────────────────────────────────────────────────

interface OwnerInfo {
  id: string
  name: string
}

interface Animal {
  id: string
  tag_number: string
  name: string | null
  sex: string | null
  breed: string | null
  status: string
}

interface Invoice {
  id: string
  invoice_number: string
  period_start: string | null
  period_end: string | null
  total_amount: number
  status: string
  due_date: string | null
  pdf_url: string | null
  created_at: string
}

interface Settlement {
  id: string
  settlement_year: number
  calves_born: number | null
  calves_weaned: number | null
  operator_calf_share: number | null
  owner_calf_share: number | null
  balance_due_to_operator: number | null
  balance_due_to_owner: number | null
  is_settled: boolean | null
  pdf_url: string | null
}

type Tab = 'animals' | 'invoices' | 'payments' | 'annual_report'

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtMoney(n: number): string {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function statusBadge(status: string) {
  switch (status) {
    case 'paid':  return <Badge variant="success">PAID</Badge>
    case 'sent':  return <Badge variant="info">SENT</Badge>
    default:      return <Badge variant="neutral">DRAFT</Badge>
  }
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function OwnerPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [valid, setValid]           = useState<boolean | null>(null)
  const [owner, setOwner]           = useState<OwnerInfo | null>(null)
  const [animals, setAnimals]       = useState<Animal[]>([])
  const [invoices, setInvoices]     = useState<Invoice[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [tab, setTab]               = useState<Tab>('animals')
  const [loading, setLoading]       = useState(true)
  const [reportLoading, setReportLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/portals/owner/verify?token=${token}`)
      .then(r => r.json())
      .then(async d => {
        if (!d.valid) { setValid(false); setLoading(false); return }
        setOwner(d.owner)
        setValid(true)

        const [animRes, invRes, settleRes] = await Promise.all([
          fetch(`/api/animals?owner_id=${d.owner.id}&limit=200`).then(r => r.json()),
          fetch(`/api/billing?owner_id=${d.owner.id}&limit=100`).then(r => r.json()),
          fetch(`/api/grazing-owners/${d.owner.id}/settlement`).then(r => r.json()),
        ])
        setAnimals(animRes.data ?? [])
        setInvoices(invRes.data ?? [])
        setSettlements(settleRes.data ?? [])
        setLoading(false)
      })
      .catch(() => { setValid(false); setLoading(false) })
  }, [token])

  const handleGenerateReport = async () => {
    if (!owner) return
    setReportLoading(true)
    try {
      const res  = await fetch(`/api/grazing-owners/${owner.id}/annual-report?year=${selectedYear}`, { method: 'POST' })
      const data = await res.json()
      if (data.data?.pdf_url) {
        window.open(data.data.pdf_url, '_blank')
        // Refresh settlements to get updated pdf_url
        const settleRes = await fetch(`/api/grazing-owners/${owner.id}/settlement`).then(r => r.json())
        setSettlements(settleRes.data ?? [])
      }
    } finally {
      setReportLoading(false)
    }
  }

  // ─── Invalid / loading ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ backgroundColor: 'var(--surface-0)' }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (!valid) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6" style={{ backgroundColor: 'var(--surface-0)' }}>
        <div className="text-center max-w-sm">
          <div className="flex items-end justify-center gap-0 leading-none mb-4">
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, color: 'var(--accent)' }}>BRAND</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 400, color: 'var(--text)' }}>BOOK</span>
          </div>
          <p className="type-body" style={{ color: 'var(--text-muted)' }}>
            This link is invalid or has expired. Contact your ranch for a new link.
          </p>
        </div>
      </div>
    )
  }

  // ─── Portal ─────────────────────────────────────────────────────────────

  const TABS: { value: Tab; label: string }[] = [
    { value: 'animals',       label: 'MY ANIMALS' },
    { value: 'invoices',      label: 'INVOICES' },
    { value: 'annual_report', label: 'ANNUAL REPORT' },
    { value: 'payments',      label: 'PAYMENTS' },
  ]

  return (
    <div className="min-h-dvh" style={{ backgroundColor: 'var(--surface-0)' }}>
      {/* Nav */}
      <header
        className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between"
        style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-end gap-0 leading-none">
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)' }}>BRAND</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 400, color: 'var(--text)' }}>BOOK</span>
          <span className="ml-2 type-helper" style={{ color: 'var(--text-muted)' }}>Owner Portal</span>
        </div>
        <p className="type-helper font-semibold truncate max-w-[140px]" style={{ color: 'var(--text)' }}>
          {owner?.name}
        </p>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5">
        {/* Tab bar */}
        <div className="flex gap-1 mb-5 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className="px-3 py-1.5 rounded flex-shrink-0 text-xs font-bold uppercase tracking-wider transition-colors"
              style={{
                background: tab === t.value ? 'var(--accent)' : 'var(--surface-2)',
                color:      tab === t.value ? 'white'         : 'var(--text-muted)',
                border:     `1px solid ${tab === t.value ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* MY ANIMALS */}
        {tab === 'animals' && (
          <div className="flex flex-col gap-3">
            {animals.length === 0 ? (
              <EmptyState variant="neutral" title="No animals" body="No animals are assigned to your account." />
            ) : (
              animals.map(a => (
                <div
                  key={a.id}
                  className="rounded-lg px-4 py-3 flex items-center justify-between gap-3"
                  style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
                >
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                      #{a.tag_number}{a.name ? ` — ${a.name}` : ''}
                    </p>
                    <p className="type-helper mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {[a.sex, a.breed].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <Badge variant={a.status === 'active' ? 'success' : 'neutral'}>
                    {a.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        )}

        {/* INVOICES */}
        {tab === 'invoices' && (
          <div className="flex flex-col gap-3">
            {invoices.length === 0 ? (
              <EmptyState variant="neutral" title="No invoices" body="No invoices have been created yet." />
            ) : (
              invoices.map(inv => (
                <div
                  key={inv.id}
                  className="rounded-lg p-4 flex flex-col gap-2"
                  style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{inv.invoice_number}</p>
                      {(inv.period_start || inv.period_end) && (
                        <p className="type-helper mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {fmtDate(inv.period_start)} – {fmtDate(inv.period_end)}
                        </p>
                      )}
                      {inv.due_date && inv.status !== 'paid' && (
                        <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
                          Due: {fmtDate(inv.due_date)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {statusBadge(inv.status)}
                      <span className="font-bold text-base" style={{ color: 'var(--gold-fg, #d97706)' }}>
                        {fmtMoney(inv.total_amount)}
                      </span>
                    </div>
                  </div>
                  {inv.pdf_url && (
                    <a
                      href={inv.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="type-helper font-semibold underline"
                      style={{ color: 'var(--accent)' }}
                    >
                      Download PDF
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ANNUAL REPORT */}
        {tab === 'annual_report' && (() => {
          const years = settlements.length > 0
            ? [...new Set(settlements.map(s => s.settlement_year))].sort((a, b) => b - a)
            : [new Date().getFullYear()]
          const yearSettlement = settlements.find(s => s.settlement_year === selectedYear) ?? null
          return (
            <div className="flex flex-col gap-4">
              {/* Year selector */}
              <div className="flex items-center gap-2">
                <span className="type-helper" style={{ color: 'var(--text-muted)' }}>Year:</span>
                {years.map(y => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setSelectedYear(y)}
                    className="px-3 py-1 rounded text-xs font-bold uppercase tracking-wider"
                    style={{
                      background: selectedYear === y ? 'var(--accent)' : 'var(--surface-2)',
                      color:      selectedYear === y ? 'white'         : 'var(--text-muted)',
                      border:     `1px solid ${selectedYear === y ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                  >
                    {y}
                  </button>
                ))}
              </div>

              {yearSettlement ? (
                <>
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Calves Born',      value: yearSettlement.calves_born      ?? '—' },
                      { label: 'Calves Weaned',    value: yearSettlement.calves_weaned    ?? '—' },
                      { label: 'Your Calves',      value: yearSettlement.owner_calf_share ?? '—' },
                      { label: 'Operator Share',   value: yearSettlement.operator_calf_share ?? '—' },
                    ].map(({ label, value }) => (
                      <div
                        key={label}
                        className="rounded-lg p-3"
                        style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
                      >
                        <p className="type-helper" style={{ color: 'var(--text-muted)' }}>{label}</p>
                        <p className="font-bold text-lg" style={{ color: 'var(--text)' }}>{value}</p>
                      </div>
                    ))}
                  </div>
                  {/* Balance */}
                  <div
                    className="rounded-lg p-4"
                    style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
                  >
                    {(yearSettlement.balance_due_to_operator ?? 0) > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="type-helper font-semibold" style={{ color: 'var(--text-muted)' }}>Balance due to operator</span>
                        <span className="font-bold text-base" style={{ color: 'var(--text)' }}>
                          {fmtMoney(yearSettlement.balance_due_to_operator!)}
                        </span>
                      </div>
                    )}
                    {(yearSettlement.balance_due_to_owner ?? 0) > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="type-helper font-semibold" style={{ color: 'var(--text-muted)' }}>Balance due to you</span>
                        <span className="font-bold text-base" style={{ color: 'var(--text)' }}>
                          {fmtMoney(yearSettlement.balance_due_to_owner!)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 mt-2">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-bold uppercase"
                        style={{
                          background: yearSettlement.is_settled ? 'var(--success-bg, #dcfce7)' : 'var(--warning-bg, #fef3c7)',
                          color:      yearSettlement.is_settled ? 'var(--success-fg)' : 'var(--warning-fg, #d97706)',
                        }}
                      >
                        {yearSettlement.is_settled ? 'SETTLED' : 'PENDING'}
                      </span>
                    </div>
                  </div>
                  {/* Download */}
                  <div className="flex flex-col gap-2">
                    {yearSettlement.pdf_url ? (
                      <a
                        href={yearSettlement.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-center py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider"
                        style={{ background: 'var(--accent)', color: 'white' }}
                      >
                        DOWNLOAD ANNUAL REPORT
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={handleGenerateReport}
                        disabled={reportLoading}
                        className="w-full py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider"
                        style={{ background: 'var(--accent)', color: 'white', opacity: reportLoading ? 0.6 : 1 }}
                      >
                        {reportLoading ? 'GENERATING…' : 'GENERATE ANNUAL REPORT'}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <EmptyState
                  variant="neutral"
                  title={`No ${selectedYear} settlement`}
                  body="No settlement has been recorded for this year yet. Contact your ranch for details."
                />
              )}
            </div>
          )
        })()}

        {/* PAYMENTS */}
        {tab === 'payments' && (
          <ContextBanner tone="info" eyebrow="COMING SOON">
            Online payments via Square will be available soon. Contact your ranch to arrange payment.
          </ContextBanner>
        )}
      </div>
    </div>
  )
}
