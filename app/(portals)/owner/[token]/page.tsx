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

type Tab = 'animals' | 'invoices' | 'payments'

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

  const [valid, setValid]       = useState<boolean | null>(null)
  const [owner, setOwner]       = useState<OwnerInfo | null>(null)
  const [animals, setAnimals]   = useState<Animal[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [tab, setTab]           = useState<Tab>('animals')
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    fetch(`/api/portals/owner/verify?token=${token}`)
      .then(r => r.json())
      .then(async d => {
        if (!d.valid) { setValid(false); setLoading(false); return }
        setOwner(d.owner)
        setValid(true)

        const [animRes, invRes] = await Promise.all([
          fetch(`/api/animals?owner_id=${d.owner.id}&limit=200`).then(r => r.json()),
          fetch(`/api/billing?owner_id=${d.owner.id}&limit=100`).then(r => r.json()),
        ])
        setAnimals(animRes.data ?? [])
        setInvoices(invRes.data ?? [])
        setLoading(false)
      })
      .catch(() => { setValid(false); setLoading(false) })
  }, [token])

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
    { value: 'animals',  label: 'MY ANIMALS' },
    { value: 'invoices', label: 'INVOICES' },
    { value: 'payments', label: 'PAYMENTS' },
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
