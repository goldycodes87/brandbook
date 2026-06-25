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
import { QuarterlyInvoiceSheet } from '@/components/billing/QuarterlyInvoiceSheet'
import { Send, CheckCircle, FileText, DollarSign } from 'lucide-react'
import { apiGet, apiPatch } from '@/lib/fetch'

// ─── Types ─────────────────────────────────────────────────────────────────

interface Owner {
  id: string
  name: string
  company_name: string | null
  owner_name: string | null
  email: string | null
  portal_token: string | null
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
  status: 'draft' | 'approved' | 'sent' | 'paid'
  approved_at: string | null
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
    case 'paid':     return <Badge variant="success">PAID</Badge>
    case 'sent':     return <Badge variant="info">SENT</Badge>
    case 'approved': return <Badge variant="warning">APPROVED</Badge>
    default:         return <Badge variant="neutral">DRAFT</Badge>
  }
}

const STATUS_TABS = ['all', 'draft', 'approved', 'sent', 'paid'] as const

// ─── Invoice Card ──────────────────────────────────────────────────────────

interface InvoiceCardProps {
  invoice: Invoice
  onApprove: (id: string) => void
  onSend: (id: string) => void
  onMarkPaid: (id: string) => void
  onPreviewPDF: (id: string) => void
  actionLoading: boolean
}

function InvoiceCard({ invoice, onApprove, onSend, onMarkPaid, onPreviewPDF, actionLoading }: InvoiceCardProps) {
  const overdue   = invoice.status === 'sent' ? daysOverdue(invoice.due_date) : null
  const isOverdue = overdue !== null && overdue > 0
  const router    = useRouter()

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
        <p className="type-helper" style={{ color: isOverdue ? 'var(--danger-fg)' : 'var(--text-muted)' }}>
          {isOverdue ? `Overdue ${overdue} day${overdue !== 1 ? 's' : ''}` : `Due ${fmtDate(invoice.due_date)}`}
        </p>
      )}

      <div className="flex items-center gap-2 mt-1 flex-wrap">
        <Button intent="secondary" size="sm" onClick={() => router.push(`/billing/${invoice.id}`)}>
          VIEW
        </Button>

        {invoice.status === 'draft' && (
          <Button intent="primary" size="sm" loading={actionLoading} onClick={() => onApprove(invoice.id)}>
            APPROVE →
          </Button>
        )}

        {invoice.status === 'approved' && (
          <>
            <Button intent="primary" size="sm" loading={actionLoading} onClick={() => onSend(invoice.id)}>
              <Send size={13} className="mr-1" />
              SEND →
            </Button>
            <Button intent="ghost" size="sm" loading={actionLoading} onClick={() => onPreviewPDF(invoice.id)}>
              PREVIEW PDF
            </Button>
          </>
        )}

        {invoice.status === 'sent' && (
          <>
            <Button intent="secondary" size="sm" onClick={() => onMarkPaid(invoice.id)}>
              <CheckCircle size={13} className="mr-1" />
              MARK PAID
            </Button>
            <Button intent="ghost" size="sm" loading={actionLoading} onClick={() => onSend(invoice.id)}>
              RESEND
            </Button>
          </>
        )}

        {invoice.status === 'paid' && (
          <Button intent="ghost" size="sm" loading={actionLoading} onClick={() => onPreviewPDF(invoice.id)}>
            <FileText size={13} className="mr-1" />
            VIEW PDF
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().slice(0, 10) }

export default function BillingPage() {
  const [invoices, setInvoices]   = useState<Invoice[]>([])
  const [loading, setLoading]     = useState(true)
  const [statusTab, setStatusTab] = useState<string>('all')
  const [search, setSearch]       = useState('')
  const [showCreate, setShowCreate]       = useState(false)
  const [showQuarterly, setShowQuarterly] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Mark Paid modal state
  const [markPaidId,      setMarkPaidId]      = useState<string | null>(null)
  const [paymentMethod,   setPaymentMethod]   = useState<'check' | 'card' | 'ach' | 'other'>('check')
  const [paidAmount,      setPaidAmount]      = useState('')
  const [paidDate,        setPaidDate]        = useState(todayStr())
  const [paymentRef,      setPaymentRef]      = useState('')

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

  const handleApprove = async (id: string) => {
    if (!confirm('Approve this invoice?\nOnce approved you can send it to the owner.')) return
    setActionLoading(true)
    try {
      await apiPatch(`/api/billing/${id}`, { status: 'approved' })
      load()
    } finally { setActionLoading(false) }
  }

  const handleSend = async (id: string) => {
    const inv = invoices.find(i => i.id === id)
    const ownerEmail = inv?.owner?.email || '(no email on file)'
    if (!confirm(`Send invoice to ${ownerEmail}?\n\nThis will email the invoice with PDF attached.`)) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/billing/${id}/send`, { method: 'POST' })
      if (!res.ok) { const j = await res.json(); alert(`Send failed: ${j.error || 'Unknown error'}`); return }
      load()
    } catch { alert('Connection error') }
    finally { setActionLoading(false) }
  }

  const handlePreviewPDF = async (id: string) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/billing/${id}/pdf`, { method: 'POST' })
      const j   = await res.json()
      if (j.pdf_url) window.open(j.pdf_url, '_blank')
      else alert('PDF generation failed')
    } catch { alert('Connection error') }
    finally { setActionLoading(false) }
  }

  const handleMarkPaid = (id: string) => {
    const inv = invoices.find(i => i.id === id)
    setMarkPaidId(id)
    setPaidAmount(String(inv?.total_amount || ''))
    setPaidDate(todayStr())
    setPaymentMethod('check')
    setPaymentRef('')
  }

  const confirmMarkPaid = async () => {
    if (!markPaidId) return
    setActionLoading(true)
    try {
      await apiPatch(`/api/billing/${markPaidId}`, {
        status:            'paid',
        payment_method:    paymentMethod,
        paid_amount:       parseFloat(paidAmount) || null,
        paid_at:           paidDate ? new Date(paidDate + 'T12:00:00').toISOString() : new Date().toISOString(),
        payment_reference: paymentRef || null,
      })
      setMarkPaidId(null)
      load()
    } catch { alert('Failed to update') }
    finally { setActionLoading(false) }
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
          <div className="flex gap-2">
            <Button intent="secondary" size="sm" onClick={() => setShowQuarterly(true)}>
              QUARTERLY INVOICE
            </Button>
            <Button intent="primary" size="sm" onClick={() => setShowCreate(true)}>
              + CREATE INVOICE
            </Button>
          </div>
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

      <QuarterlyInvoiceSheet
        isOpen={showQuarterly}
        onClose={() => setShowQuarterly(false)}
        onSuccess={inv => { setShowQuarterly(false); router.push(`/billing/${inv.id}`) }}
      />

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
            <InvoiceCard
              key={inv.id}
              invoice={inv}
              onApprove={handleApprove}
              onSend={handleSend}
              onMarkPaid={handleMarkPaid}
              onPreviewPDF={handlePreviewPDF}
              actionLoading={actionLoading}
            />
          ))}
        </div>
      )}
      {/* Mark Paid Modal */}
      {markPaidId && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setMarkPaidId(null)}
        >
          <div
            className="rounded-t-2xl md:rounded-2xl p-6 w-full md:max-w-sm flex flex-col gap-4"
            style={{ background: 'var(--surface-0)', maxHeight: '90dvh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>MARK AS PAID</h2>

            <div>
              <p className="type-helper mb-2" style={{ color: 'var(--text-muted)' }}>Payment Method</p>
              <div className="grid grid-cols-4 gap-1.5">
                {(['check', 'card', 'ach', 'other'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className="py-2 rounded-lg text-xs font-bold uppercase transition-all"
                    style={{
                      background: paymentMethod === m ? 'var(--accent)' : 'var(--surface-1)',
                      color:      paymentMethod === m ? 'white' : 'var(--text-muted)',
                      border:     `1px solid ${paymentMethod === m ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="type-helper block mb-1" style={{ color: 'var(--text-muted)' }}>Amount</label>
              <input
                type="number" step="0.01" value={paidAmount}
                onChange={e => setPaidAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
            </div>

            <div>
              <label className="type-helper block mb-1" style={{ color: 'var(--text-muted)' }}>Date</label>
              <input
                type="date" value={paidDate}
                onChange={e => setPaidDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
            </div>

            <div>
              <label className="type-helper block mb-1" style={{ color: 'var(--text-muted)' }}>Reference / Check #</label>
              <input
                type="text" placeholder="Optional" value={paymentRef}
                onChange={e => setPaymentRef(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
            </div>

            <div className="flex gap-3">
              <Button intent="ghost" size="sm" onClick={() => setMarkPaidId(null)}>CANCEL</Button>
              <Button intent="primary" size="sm" className="flex-1" loading={actionLoading} onClick={confirmMarkPaid}>
                MARK AS PAID
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
