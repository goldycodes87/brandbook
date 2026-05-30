'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { StatCard } from '@/components/ui/StatCard'
import { EmptyState } from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import { InvoiceForm } from '@/components/billing/InvoiceForm'
import { Send, CheckCircle, FileText, DollarSign } from 'lucide-react'
import { apiGet } from '@/lib/fetch'

// ─── Types ─────────────────────────────────────────────────────────────────

interface Owner {
  id: string
  name: string
  company_name: string | null
  owner_name: string | null
}

interface Invoice {
  id: string
  invoice_number: string
  owner_id: string
  owner: Owner | null
  period_start: string | null
  period_end: string | null
  due_date: string | null
  total_amount: number
  status: 'draft' | 'sent' | 'paid'
  sent_at: string | null
  email_sent_at: string | null
  paid_at: string | null
  created_at: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function ownerDisplay(owner: Owner | null): string {
  if (!owner) return '—'
  return owner.company_name || owner.owner_name || owner.name
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtMoney(n: number): string {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function daysOverdue(d: string | null): number | null {
  if (!d) return null
  const diff = Date.now() - new Date(d + 'T00:00:00').getTime()
  return Math.floor(diff / 86400000)
}

function statusBadge(status: string) {
  switch (status) {
    case 'paid':  return <Badge variant="success">PAID</Badge>
    case 'sent':  return <Badge variant="info">SENT</Badge>
    default:      return <Badge variant="neutral">DRAFT</Badge>
  }
}

const STATUS_TABS = ['all', 'draft', 'sent', 'paid'] as const

// ─── Invoice Card ──────────────────────────────────────────────────────────

function InvoiceCard({ invoice, onMarkPaid }: { invoice: Invoice; onMarkPaid: (id: string) => void }) {
  const overdue = invoice.status === 'sent' ? daysOverdue(invoice.due_date) : null
  const isOverdue = overdue !== null && overdue > 0
  const router = useRouter()

  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-2"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{invoice.invoice_number}</p>
          <p className="font-semibold text-sm mt-0.5 truncate" style={{ color: 'var(--text)' }}>
            {ownerDisplay(invoice.owner)}
          </p>
          {(invoice.period_start || invoice.period_end) && (
            <p className="type-helper mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {fmtDate(invoice.period_start)} – {fmtDate(invoice.period_end)}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {statusBadge(invoice.status)}
          <span className="text-lg font-bold" style={{ color: 'var(--gold-fg, #d97706)' }}>
            {fmtMoney(invoice.total_amount)}
          </span>
        </div>
      </div>

      {invoice.due_date && invoice.status !== 'paid' && (
        <p
          className="type-helper"
          style={{ color: isOverdue ? 'var(--danger-fg)' : 'var(--text-muted)' }}
        >
          {isOverdue
            ? `Overdue ${overdue} day${overdue !== 1 ? 's' : ''}`
            : `Due ${fmtDate(invoice.due_date)}`}
        </p>
      )}

      <div className="flex items-center gap-2 mt-1">
        <Button
          intent="secondary" size="sm"
          onClick={() => router.push(`/billing/${invoice.id}`)}
        >
          VIEW
        </Button>
        {invoice.status === 'sent' && (
          <Button intent="primary" size="sm" onClick={() => onMarkPaid(invoice.id)}>
            <CheckCircle size={13} className="mr-1" />
            MARK PAID
          </Button>
        )}
        {invoice.status === 'draft' && (
          <Button intent="ghost" size="sm" onClick={() => router.push(`/billing/${invoice.id}`)}>
            <Send size={13} className="mr-1" />
            SEND
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [invoices, setInvoices]   = useState<Invoice[]>([])
  const [loading, setLoading]     = useState(true)
  const [statusTab, setStatusTab] = useState<string>('all')
  const [search, setSearch]       = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const router = useRouter()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const url = `/api/billing?limit=100${statusTab !== 'all' ? `&status=${statusTab}` : ''}`
      const res  = await apiGet(url)
      const json = await res.json()
      setInvoices(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [statusTab])

  useEffect(() => { load() }, [load])

  const handleMarkPaid = async (id: string) => {
    await fetch(`/api/billing/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paid', paid_at: new Date().toISOString() }),
    })
    load()
  }

  const filtered = invoices.filter(inv => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (inv.invoice_number ?? '').toLowerCase().includes(q) ||
      ownerDisplay(inv.owner).toLowerCase().includes(q)
    )
  })

  // Stats
  const outstanding = invoices.filter(i => i.status === 'sent').reduce((s, i) => s + Number(i.total_amount || 0), 0)
  const thisYear    = new Date().getFullYear()
  const paidYTD     = invoices.filter(i => i.status === 'paid' && i.paid_at?.startsWith(String(thisYear))).reduce((s, i) => s + Number(i.total_amount || 0), 0)
  const drafts      = invoices.filter(i => i.status === 'draft').length
  const totalBilled = invoices.reduce((s, i) => s + Number(i.total_amount || 0), 0)

  if (showCreate) {
    return (
      <PageContainer>
        <PageHeader
          eyebrow="BILLING"
          title="CREATE INVOICE"
          actions={<Button intent="ghost" size="sm" onClick={() => setShowCreate(false)}>← BACK</Button>}
        />
        <InvoiceForm
          mode="create"
          onSuccess={inv => {
            setShowCreate(false)
            if (inv?.id) router.push(`/billing/${inv.id}`)
            else load()
          }}
          onCancel={() => setShowCreate(false)}
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="BILLING"
        title="INVOICES"
        subtitle={`${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}`}
        actions={
          <Button intent="primary" size="sm" onClick={() => setShowCreate(true)}>
            + CREATE INVOICE
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard
          label="OUTSTANDING"
          value={fmtMoney(outstanding)}
          valueColor={outstanding > 0 ? 'var(--danger-fg)' : undefined}
          aside={<Send size={16} style={{ color: 'var(--text-muted)' }} />}
        />
        <StatCard
          label="PAID THIS YEAR"
          value={fmtMoney(paidYTD)}
          valueColor="var(--success-fg)"
          aside={<CheckCircle size={16} style={{ color: 'var(--text-muted)' }} />}
        />
        <StatCard
          label="DRAFT INVOICES"
          value={drafts}
          aside={<FileText size={16} style={{ color: 'var(--text-muted)' }} />}
        />
        <StatCard
          label="TOTAL BILLED YTD"
          value={fmtMoney(totalBilled)}
          valueColor="var(--gold-fg, #d97706)"
          aside={<DollarSign size={16} style={{ color: 'var(--text-muted)' }} />}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search owner or invoice #…"
          className="flex-1 px-3 py-2 rounded-lg text-sm"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
          }}
        />
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_TABS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusTab(s)}
              className="px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors"
              style={{
                background:   statusTab === s ? 'var(--accent)' : 'var(--surface-2)',
                color:        statusTab === s ? 'white'        : 'var(--text-muted)',
                border:       `1px solid ${statusTab === s ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 rounded-lg animate-pulse" style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          variant="neutral"
          title="No invoices"
          body={search ? 'No invoices match your search.' : 'Create invoices for your custom grazing owners.'}
          action={!search ? <Button intent="primary" size="sm" onClick={() => setShowCreate(true)}>+ CREATE INVOICE</Button> : undefined}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(inv => (
            <InvoiceCard key={inv.id} invoice={inv} onMarkPaid={handleMarkPaid} />
          ))}
        </div>
      )}
    </PageContainer>
  )
}
