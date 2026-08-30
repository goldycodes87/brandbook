'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { EmptyState } from '@/components/ui/EmptyState'
import { apiGet, apiPost } from '@/lib/fetch'
import { fmtDate, fmtMoneyDecimals as fmtMoney } from '@/lib/format'

type Decision = 'create' | 'attach' | 'skip'

interface LineItem {
  id: string
  line_no: number
  description: string | null
  amount: number | null
  suggested_category_id: string | null
  suggested_category_name: string | null
  matched_expense_id: string | null
  match_score: number | null
  match_reason: string | null
  decision: Decision
}

interface Receipt {
  id: string
  r2_key: string
  filename: string | null
  content_type: string | null
  vendor: string | null
  receipt_date: string | null
  receipt_total: number | null
  parse_status: 'pending' | 'parsed' | 'failed'
  parse_error: string | null
  email: { from_address: string; subject: string | null; received_at: string } | null
  line_items: LineItem[]
}

interface MatchedExpense {
  id: string
  description: string | null
  category_name: string | null
  total_amount: number
  expense_date: string | null
}

interface Category { id: string; name: string; expense_type: string }

const DECISIONS: Array<{ value: Decision; label: string; tone: string }> = [
  { value: 'create', label: 'RECORD',  tone: 'var(--accent)' },
  { value: 'attach', label: 'ALREADY', tone: 'var(--success-fg)' },
  { value: 'skip',   label: 'SKIP',    tone: 'var(--text-muted)' },
]

export default function ExpenseReviewPage() {
  const router = useRouter()

  const [receipts, setReceipts]   = useState<Receipt[]>([])
  const [matched, setMatched]     = useState<Record<string, MatchedExpense>>({})
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [saving, setSaving]       = useState<string | null>(null)
  const [edits, setEdits]         = useState<Record<string, Partial<LineItem>>>({})

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiGet('/api/expenses/review').then(r => r.json()),
      apiGet('/api/expenses/categories').then(r => r.json()).catch(() => ({ data: [] })),
    ])
      .then(([queue, cats]) => {
        if (cancelled) return
        if (queue.error) { setError(queue.error); return }
        setReceipts(queue.data ?? [])
        setMatched(Object.fromEntries(
          ((queue.matched_expenses ?? []) as MatchedExpense[]).map(m => [m.id, m]),
        ))
        // That endpoint returns categories grouped by expense_type; the queue
        // wants one flat list, and each category already carries the type.
        const g = (cats.data ?? {}) as Record<string, Category[]>
        setCategories([
          ...(g.shared ?? []), ...(g.owner_specific ?? []), ...(g.animal_specific ?? []),
        ])
      })
      .catch(() => { if (!cancelled) setError('Connection error') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const lineValue = (l: LineItem) => ({ ...l, ...(edits[l.id] ?? {}) })
  const patch = (id: string, p: Partial<LineItem>) =>
    setEdits(prev => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...p } }))

  async function submit(receipt: Receipt) {
    setSaving(receipt.id); setError('')
    try {
      const res = await apiPost(`/api/expenses/review/${receipt.id}`, {
        lines: receipt.line_items.map(raw => {
          const l = lineValue(raw)
          const cat = categories.find(c => c.id === l.suggested_category_id)
          return {
            id: l.id,
            decision: l.decision,
            description: l.description,
            amount: l.amount,
            category_id: l.suggested_category_id,
            category_name: cat?.name ?? l.suggested_category_name,
            expense_type: cat?.expense_type ?? 'shared',
            matched_expense_id: l.matched_expense_id,
          }
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setError(json.problems?.join('; ') || json.error || 'Some lines could not be saved')
        return
      }
      setReceipts(prev => prev.filter(r => r.id !== receipt.id))
    } catch {
      setError('Connection error')
    } finally { setSaving(null) }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="EXPENSES"
        title="RECEIPT REVIEW"
        subtitle={receipts.length > 0 ? `${receipts.length} waiting` : undefined}
        actions={<Button intent="ghost" size="sm" onClick={() => router.push('/billing')}>← BACK</Button>}
      />

      {error && <ContextBanner tone="danger">{error}</ContextBanner>}

      {loading && <p className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Loading…</p>}

      {!loading && receipts.length === 0 && (
        <EmptyState
          variant="neutral"
          title="Nothing to review"
          body="Forward a receipt to receipts@mail.legacylandandcattleco.com and it'll show up here."
        />
      )}

      <div className="flex flex-col gap-4 pb-8">
        {receipts.map(receipt => (
          <div
            key={receipt.id}
            className="rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--border)', background: 'var(--surface-1)' }}
          >
            {/* Receipt header */}
            <div className="px-4 py-3" style={{ background: 'var(--surface-2)' }}>
              <div className="flex justify-between items-baseline gap-3">
                <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                  {receipt.vendor ?? receipt.filename ?? 'Receipt'}
                </span>
                {receipt.receipt_total != null && (
                  <span className="font-bold text-sm" style={{ color: 'var(--gold-fg, #d97706)' }}>
                    {fmtMoney(receipt.receipt_total)}
                  </span>
                )}
              </div>
              <p className="type-helper mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {[
                  receipt.receipt_date ? fmtDate(receipt.receipt_date) : null,
                  receipt.email ? `from ${receipt.email.from_address}` : null,
                ].filter(Boolean).join(' · ')}
              </p>
              <a
                href={`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${receipt.r2_key}`}
                target="_blank" rel="noopener noreferrer"
                className="type-helper underline"
                style={{ color: 'var(--accent)' }}
              >
                View the original
              </a>
            </div>

            {receipt.parse_status === 'failed' && (
              <div className="px-4 py-3">
                <ContextBanner tone="danger">
                  Couldn&apos;t read this one: {receipt.parse_error ?? 'unknown error'}. The file is
                  still stored — enter it by hand.
                </ContextBanner>
              </div>
            )}

            {/* Lines */}
            {receipt.line_items.map(raw => {
              const l = lineValue(raw)
              const m = l.matched_expense_id ? matched[l.matched_expense_id] : null
              return (
                <div key={l.id} className="px-4 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <div className="flex justify-between items-baseline gap-3">
                    <span className="text-sm" style={{ color: 'var(--text)' }}>{l.description}</span>
                    <span className="text-sm font-semibold whitespace-nowrap" style={{ color: 'var(--text)' }}>
                      {l.amount != null ? fmtMoney(l.amount) : '—'}
                    </span>
                  </div>

                  {m && (
                    <p className="type-helper mt-1" style={{ color: 'var(--success-fg)' }}>
                      Looks like: {m.description ?? m.category_name} · {fmtMoney(m.total_amount)} ·{' '}
                      {m.expense_date ? fmtDate(m.expense_date) : '—'}
                      {l.match_reason ? ` (${l.match_reason})` : ''}
                    </p>
                  )}
                  {!m && raw.suggested_category_name === null && (
                    <p className="type-helper mt-1" style={{ color: 'var(--text-muted)' }}>
                      Doesn&apos;t look like a ranch expense
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {DECISIONS.map(d => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => patch(l.id, { decision: d.value })}
                        disabled={d.value === 'attach' && !l.matched_expense_id}
                        className="px-3 py-1.5 rounded text-xs font-bold disabled:opacity-30"
                        style={{
                          border: `1px solid ${l.decision === d.value ? d.tone : 'var(--border)'}`,
                          background: l.decision === d.value ? 'var(--surface-2)' : 'transparent',
                          color: l.decision === d.value ? d.tone : 'var(--text-muted)',
                        }}
                      >
                        {d.label}
                      </button>
                    ))}

                    {l.decision === 'create' && (
                      <select
                        value={l.suggested_category_id ?? ''}
                        onChange={e => patch(l.id, { suggested_category_id: e.target.value || null })}
                        className="rounded px-2 py-1.5 text-xs"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                      >
                        <option value="">Pick a category…</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )
            })}

            <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ borderTop: '1px solid var(--border)' }}>
              <span className="type-helper" style={{ color: 'var(--text-muted)' }}>
                {receipt.line_items.filter(l => lineValue(l).decision === 'create').length} to record ·{' '}
                {receipt.line_items.filter(l => lineValue(l).decision === 'attach').length} already on the books ·{' '}
                {receipt.line_items.filter(l => lineValue(l).decision === 'skip').length} skipped
              </span>
              <Button
                intent="primary"
                size="sm"
                loading={saving === receipt.id}
                onClick={() => submit(receipt)}
              >
                CONFIRM
              </Button>
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  )
}
