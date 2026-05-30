'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { InvoiceForm } from '@/components/billing/InvoiceForm'
import { Send, Download, CheckCircle, RotateCcw, ArrowLeft, Printer, Link, DollarSign } from 'lucide-react'
import { apiGet, apiPatch } from '@/lib/fetch'
import { SegmentedControl } from '@/components/ui/SegmentedControl'

// ─── Types ─────────────────────────────────────────────────────────────────

interface Owner {
  id: string
  name: string
  company_name: string | null
  owner_name: string | null
  email: string | null
  phone: string | null
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
  status: 'draft' | 'sent' | 'paid'
  notes: string | null
  pdf_url: string | null
  sent_at: string | null
  email_sent_at: string | null
  paid_at: string | null
  viewed_at: string | null
  created_at: string
  square_payment_link: string | null
  payment_method: string | null
  payment_reference: string | null
  line_items: Array<{ description: string; amount: number }>
  expense_splits: Array<{ description: string; category: string; owner_amount: number }>
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function fmtMoney(n: number): string {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ownerDisplay(owner: Owner | null): string {
  if (!owner) return '—'
  return owner.company_name || owner.owner_name || owner.name
}

function statusBadge(status: string) {
  switch (status) {
    case 'paid':  return <Badge variant="success">PAID</Badge>
    case 'sent':  return <Badge variant="info">SENT</Badge>
    default:      return <Badge variant="neutral">DRAFT</Badge>
  }
}

// ─── Invoice Preview ────────────────────────────────────────────────────────

function InvoicePreview({ invoice }: { invoice: Invoice }) {
  const owner = invoice.owner

  return (
    <div
      className="rounded-lg p-6 flex flex-col gap-5"
      style={{ background: 'white', border: '1px solid #e5e7eb', color: '#111' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-bold text-xl" style={{ color: '#111' }}>
            {ownerDisplay(owner)}
          </p>
          {owner?.email && <p className="text-sm mt-1" style={{ color: '#666' }}>{owner.email}</p>}
          {owner?.phone && <p className="text-sm" style={{ color: '#666' }}>{owner.phone}</p>}
        </div>
        <div className="text-right">
          <p className="font-bold text-2xl" style={{ color: '#ea580c' }}>INVOICE</p>
          <p className="font-mono text-sm mt-1" style={{ color: '#666' }}>{invoice.invoice_number}</p>
          {invoice.period_start && (
            <p className="text-xs mt-1" style={{ color: '#888' }}>
              Period: {fmtDate(invoice.period_start)} – {fmtDate(invoice.period_end)}
            </p>
          )}
          {invoice.due_date && (
            <p className="text-xs mt-0.5" style={{ color: '#e53e3e' }}>Due: {fmtDate(invoice.due_date)}</p>
          )}
        </div>
      </div>

      {/* Line items */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f9fafb' }}>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: '#888', fontWeight: 700 }}>Description</th>
            <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, textTransform: 'uppercase', color: '#888', fontWeight: 700 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {(invoice.line_items ?? []).map((li, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '10px 12px', fontSize: 14 }}>{li.description}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 14 }}>{fmtMoney(li.amount)}</td>
            </tr>
          ))}
          {(invoice.expense_splits ?? []).map((e, i) => (
            <tr key={`e${i}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '10px 12px', fontSize: 14 }}>
                {e.description}
                {e.category && <span style={{ color: '#888', fontSize: 12, marginLeft: 6 }}>({e.category})</span>}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 14 }}>{fmtMoney(e.owner_amount)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ padding: '14px 12px', fontWeight: 700, fontSize: 15, borderTop: '2px solid #111' }}>TOTAL DUE</td>
            <td style={{ padding: '14px 12px', textAlign: 'right', fontWeight: 700, fontSize: 20, color: '#ea580c', borderTop: '2px solid #111' }}>
              {fmtMoney(invoice.total_amount)}
            </td>
          </tr>
        </tbody>
      </table>

      {invoice.notes && (
        <p style={{ color: '#666', fontSize: 13 }}>Notes: {invoice.notes}</p>
      )}
    </div>
  )
}

// ─── Activity Log ───────────────────────────────────────────────────────────

function ActivityLog({ invoice }: { invoice: Invoice }) {
  const events = [
    { label: 'Created',  date: invoice.created_at },
    { label: 'Sent',     date: invoice.sent_at },
    { label: 'Viewed',   date: invoice.viewed_at },
    { label: 'Paid',     date: invoice.paid_at },
  ].filter(e => e.date)

  if (!events.length) return null

  return (
    <div className="flex flex-col gap-1.5">
      <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>ACTIVITY</p>
      {events.map((e, i) => (
        <div key={i} className="flex items-center justify-between type-helper">
          <span style={{ color: 'var(--text-muted)' }}>{e.label}</span>
          <span style={{ color: 'var(--text)' }}>
            {new Date(e.date!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router  = useRouter()

  const [invoice, setInvoice]       = useState<Invoice | null>(null)
  const [loading, setLoading]       = useState(true)
  const [editing, setEditing]       = useState(false)
  const [sending, setSending]       = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [creatingLink, setCreatingLink] = useState(false)
  const [confirmSend, setConfirmSend] = useState(false)
  const [confirmPaid, setConfirmPaid] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paymentReference, setPaymentReference] = useState('')
  const [actionError, setActionError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res  = await apiGet(`/api/billing/${id}`)
      const json = await res.json()
      setInvoice(json.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = async () => {
    setSending(true); setActionError('')
    try {
      const res  = await fetch(`/api/billing/${id}/send`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setActionError(json.error ?? 'Send failed'); return }
      await load()
    } catch {
      setActionError('Connection error')
    } finally {
      setSending(false); setConfirmSend(false)
    }
  }

  const handleMarkPaid = async () => {
    const body: Record<string, unknown> = {
      status:   'paid',
      paid_at:  new Date().toISOString(),
      payment_method: paymentMethod || null,
    }
    if (paymentReference.trim()) body.payment_reference = paymentReference.trim()
    const res = await apiPatch(`/api/billing/${id}`, body)
    if (res.ok) { setConfirmPaid(false); load() }
  }

  const handleCreateSquareLink = async () => {
    setCreatingLink(true); setActionError('')
    try {
      const res  = await fetch(`/api/billing/${id}/square-link`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setActionError(json.error ?? 'Failed to create payment link'); return }
      load()
    } catch {
      setActionError('Connection error')
    } finally {
      setCreatingLink(false)
    }
  }

  const handleDownloadPdf = async () => {
    setGeneratingPdf(true); setActionError('')
    try {
      const res  = await fetch(`/api/billing/${id}/pdf`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setActionError(json.error ?? 'PDF generation failed'); return }
      window.open(json.pdf_url, '_blank')
      load()
    } catch {
      setActionError('PDF generation failed')
    } finally {
      setGeneratingPdf(false)
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <PageHeader title="Invoice" />
        <div className="h-64 animate-pulse rounded-lg" style={{ background: 'var(--surface-1)' }} />
      </PageContainer>
    )
  }

  if (!invoice) {
    return (
      <PageContainer>
        <PageHeader title="Invoice not found" />
        <Button intent="ghost" onClick={() => router.push('/billing')} leading={<ArrowLeft size={14} />}>BACK</Button>
      </PageContainer>
    )
  }

  if (editing) {
    return (
      <PageContainer>
        <PageHeader
          eyebrow={invoice.invoice_number}
          title="EDIT INVOICE"
          actions={<Button intent="ghost" size="sm" onClick={() => setEditing(false)}>← BACK</Button>}
        />
        <InvoiceForm
          mode="edit"
          initialData={invoice as unknown as Record<string, unknown>}
          onSuccess={updated => {
            setEditing(false)
            if (!updated?.id) router.push('/billing')
            else load()
          }}
          onCancel={() => setEditing(false)}
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="BILLING"
        title={invoice.invoice_number}
        actions={
          <Button intent="ghost" size="sm" onClick={() => router.push('/billing')} leading={<ArrowLeft size={14} />}>
            BACK
          </Button>
        }
        meta={
          <div className="flex items-center gap-2 mt-1">
            {statusBadge(invoice.status)}
            <span className="type-helper" style={{ color: 'var(--text-muted)' }}>
              {ownerDisplay(invoice.owner)}
            </span>
          </div>
        }
      />

      {actionError && (
        <ContextBanner tone="danger" className="mb-4">{actionError}</ContextBanner>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap gap-2 mb-5">
        {invoice.status === 'draft' && (
          <>
            <Button intent="secondary" size="sm" onClick={() => setEditing(true)}>EDIT</Button>
            <Button intent="primary" size="sm" onClick={() => setConfirmSend(true)} leading={<Send size={14} />}>
              SEND INVOICE
            </Button>
            <Button intent="ghost" size="sm" loading={generatingPdf} onClick={handleDownloadPdf} leading={<Download size={14} />}>
              DOWNLOAD PDF
            </Button>
          </>
        )}
        {invoice.status === 'sent' && (
          <>
            <Button intent="primary" size="sm" onClick={() => setConfirmPaid(true)} leading={<CheckCircle size={14} />}>
              MARK AS PAID
            </Button>
            <Button intent="ghost" size="sm" loading={generatingPdf} onClick={handleDownloadPdf} leading={<Download size={14} />}>
              DOWNLOAD PDF
            </Button>
            <Button intent="ghost" size="sm" loading={sending} onClick={() => setConfirmSend(true)} leading={<RotateCcw size={14} />}>
              RESEND
            </Button>
            {!invoice.square_payment_link && (
              <Button intent="ghost" size="sm" loading={creatingLink} onClick={handleCreateSquareLink} leading={<Link size={14} />}>
                CREATE PAYMENT LINK
              </Button>
            )}
          </>
        )}
        {invoice.status === 'paid' && (
          <Button intent="ghost" size="sm" loading={generatingPdf} onClick={handleDownloadPdf} leading={<Printer size={14} />}>
            DOWNLOAD PDF
          </Button>
        )}
      </div>

      {/* Square payment link (active) */}
      {invoice.square_payment_link && invoice.status === 'sent' && (
        <div
          className="flex items-start justify-between gap-4 rounded-lg px-4 py-3 mb-4"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-start gap-3 min-w-0">
            <Link size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
            <div className="min-w-0">
              <p className="type-helper font-semibold" style={{ color: 'var(--text-muted)' }}>SQUARE PAYMENT LINK</p>
              <p className="text-xs truncate mt-0.5" style={{ color: 'var(--accent)' }}>{invoice.square_payment_link}</p>
            </div>
          </div>
          <a href={invoice.square_payment_link} target="_blank" rel="noopener noreferrer">
            <Button intent="ghost" size="sm">OPEN</Button>
          </a>
        </div>
      )}

      {/* Mark as paid panel */}
      {confirmPaid && (
        <div
          className="rounded-lg p-5 mb-4 flex flex-col gap-4"
          style={{ background: 'var(--surface-1)', border: '2px solid var(--accent)' }}
        >
          <div className="flex items-center gap-2">
            <DollarSign size={18} style={{ color: 'var(--accent)' }} />
            <p className="font-semibold" style={{ color: 'var(--text)' }}>Record Payment</p>
          </div>
          <div>
            <p className="type-field-label mb-2" style={{ color: 'var(--text-muted)' }}>PAYMENT METHOD</p>
            <SegmentedControl
              value={paymentMethod}
              onChange={setPaymentMethod}
              items={[
                { label: 'Cash',            value: 'cash' },
                { label: 'Check',           value: 'check' },
                { label: 'Sq Terminal',     value: 'square_terminal' },
                { label: 'Sq Online',       value: 'square_online' },
              ]}
            />
          </div>
          {(paymentMethod === 'check' || paymentMethod === 'square_terminal') && (
            <div>
              <p className="type-field-label mb-1" style={{ color: 'var(--text-muted)' }}>
                {paymentMethod === 'check' ? 'CHECK NUMBER' : 'RECEIPT / REFERENCE'}
              </p>
              <input
                type="text"
                value={paymentReference}
                onChange={e => setPaymentReference(e.target.value)}
                placeholder={paymentMethod === 'check' ? 'e.g. 1042' : 'Terminal receipt #'}
                className="w-full text-sm px-3 py-2 rounded-[var(--radius-md)]"
                style={{
                  background: 'var(--surface-0)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  outline: 'none',
                }}
              />
            </div>
          )}
          <div className="flex gap-2">
            <Button intent="primary" size="sm" onClick={handleMarkPaid} leading={<CheckCircle size={14} />}>
              CONFIRM PAID
            </Button>
            <Button intent="ghost" size="sm" onClick={() => setConfirmPaid(false)}>CANCEL</Button>
          </div>
        </div>
      )}

      {/* Invoice preview */}
      <InvoicePreview invoice={invoice} />

      {/* Activity log */}
      <div className="mt-5">
        <ActivityLog invoice={invoice} />
      </div>

      {/* Dialogs */}
      <ConfirmDialog
        isOpen={confirmSend}
        onClose={() => setConfirmSend(false)}
        onConfirm={handleSend}
        title={invoice.status === 'sent' ? 'Resend invoice?' : 'Send invoice?'}
        message={`This will email the invoice to ${invoice.owner?.email ?? 'the owner'}.`}
        confirmLabel={invoice.status === 'sent' ? 'RESEND' : 'SEND'}
        loading={sending}
      />

    </PageContainer>
  )
}
