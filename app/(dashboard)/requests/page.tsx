'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Textarea } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/EmptyState'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { apiGet, apiPatch } from '@/lib/fetch'
import { fmtDate, fmtMoney } from '@/lib/format'

/**
 * What the owners have asked for.
 *
 * The portal has had Buy and Sell buttons since it shipped, writing to
 * owner_requests, and nothing on this side ever read the table — the API was
 * built and wired to no page at all. An owner pressing "I would like to sell
 * #41" got a confirmation and total silence, which is worse than not offering
 * the button.
 *
 * Access requests are deliberately absent: those are handled in Admin, where
 * granting somebody a login belongs.
 */

type Status = 'pending' | 'reviewed' | 'completed' | 'declined'

interface OwnerRequest {
  id: string
  owner_id: string
  owner_name: string
  request_type: 'buy' | 'sell' | 'access' | 'payout'
  status: Status
  quantity: number | null
  animal_type: string | null
  budget_min: number | null
  budget_max: number | null
  breed: string | null
  timeframe: string | null
  animal: { tag_number: string; name: string | null } | null
  sell_reason: string | null
  sell_timeline: string | null
  funds_disposition: string | null
  funds_other_notes: string | null
  notes: string | null
  rancher_notes: string | null
  created_at: string
}

const STATUS_TONE: Record<Status, 'warning' | 'info' | 'success' | 'neutral'> = {
  pending: 'warning', reviewed: 'info', completed: 'success', declined: 'neutral',
}

const TIMEFRAME = new Map([
  ['now', 'Now'], ['asap', 'ASAP'],
  ['1_2_weeks', '1–2 weeks'], ['1_month_plus', 'A month or more'],
])

const FUNDS = new Map([
  ['send_minus_fee', 'Send payment, less the selling fee'],
  ['keep_for_purchase', 'Keep on account to buy something else'],
  ['check', 'Mail a check'],
  ['invoice_first', 'Settle the open invoice first, then send the balance'],
  ['other', 'Other'],
])

const pretty = (m: Map<string, string>, v: string | null) =>
  v ? (m.get(v) ?? v.replace(/_/g, ' ')) : null

export default function RequestsPage() {
  const [requests, setRequests] = useState<OwnerRequest[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<'open' | 'all'>('open')
  const [saving, setSaving]     = useState<Record<string, boolean>>({})
  const [notes, setNotes]       = useState<Record<string, string>>({})
  const [error, setError]       = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await apiGet('/api/owner-requests')
      const d = await r.json()
      if (d.error) { setError(d.error); return }
      // Access requests live in Admin; this page is about cattle.
      setRequests((d.data ?? []).filter((x: OwnerRequest) => x.request_type !== 'access'))
    } catch {
      setError('Could not load requests.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function setStatus(req: OwnerRequest, status: Status) {
    setSaving(s => ({ ...s, [req.id]: true }))
    try {
      const res = await apiPatch('/api/owner-requests', {
        id: req.id,
        status,
        ...(notes[req.id] !== undefined ? { rancher_notes: notes[req.id] } : {}),
      })
      if (res.ok) await load()
      else setError('That did not save.')
    } finally {
      setSaving(s => ({ ...s, [req.id]: false }))
    }
  }

  const shown = filter === 'open'
    ? requests.filter(r => r.status === 'pending' || r.status === 'reviewed')
    : requests

  return (
    <PageContainer>
      <PageHeader
        eyebrow="OWNERS"
        title="REQUESTS"
        subtitle="What your owners have asked to buy or sell"
        actions={
          <SegmentedControl
            items={[{ value: 'open', label: 'Open' }, { value: 'all', label: 'All' }]}
            value={filter}
            onChange={v => setFilter(v as 'open' | 'all')}
          />
        }
      />

      {error && (
        <p className="text-sm px-3 py-2 mb-4 rounded-[var(--radius-md)]"
           style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
          {error}
        </p>
      )}

      {loading ? (
        <p className="type-body py-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : shown.length === 0 ? (
        <EmptyState
          variant="neutral"
          title={filter === 'open' ? 'Nothing waiting' : 'No requests yet'}
          body="When an owner asks to buy or sell from their portal, it lands here."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {shown.map(r => (
            <Panel
              key={r.id}
              title={
                <span className="flex items-center gap-2 flex-wrap">
                  <span>{
                    r.request_type === 'buy'    ? 'WANTS TO BUY'
                    : r.request_type === 'payout' ? 'WHAT TO DO WITH THE MONEY'
                    : 'WANTS TO SELL'
                  }</span>
                  <Chip tone={STATUS_TONE[r.status]} size="sm">{r.status}</Chip>
                </span>
              }
              subtitle={`${r.owner_name} · ${fmtDate(r.created_at)}`}
            >
              <div className="flex flex-col gap-3">
                {r.request_type === 'payout' ? (
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Fact label="Wants" value={pretty(FUNDS, r.funds_disposition)} />
                    <Fact label="Asked" value={fmtDate(r.created_at)} />
                  </dl>
                ) : r.request_type === 'buy' ? (
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Fact label="How many" value={r.quantity != null ? String(r.quantity) : null} />
                    <Fact label="What" value={r.animal_type} />
                    <Fact label="Breed" value={r.breed} />
                    <Fact label="When" value={pretty(TIMEFRAME, r.timeframe)} />
                    <Fact
                      label="Budget"
                      value={
                        r.budget_min != null || r.budget_max != null
                          ? `${r.budget_min != null ? fmtMoney(r.budget_min) : '—'} – ${r.budget_max != null ? fmtMoney(r.budget_max) : '—'}`
                          : null
                      }
                    />
                  </dl>
                ) : (
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Fact
                      label="Animal"
                      value={r.animal ? `#${r.animal.tag_number}${r.animal.name ? ` ${r.animal.name}` : ''}` : null}
                    />
                    <Fact label="Why" value={r.sell_reason} />
                    <Fact label="When" value={pretty(TIMEFRAME, r.sell_timeline)} />
                    <Fact label="Money" value={pretty(FUNDS, r.funds_disposition)} />
                  </dl>
                )}

                {r.funds_other_notes && (
                  <p className="type-helper" style={{ color: 'var(--text-secondary)' }}>
                    On the money: {r.funds_other_notes}
                  </p>
                )}
                {r.notes && (
                  <p className="text-sm" style={{ color: 'var(--text)' }}>&ldquo;{r.notes}&rdquo;</p>
                )}

                {r.rancher_notes && r.status !== 'pending' && (
                  <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
                    Your note: {r.rancher_notes}
                  </p>
                )}

                {(r.status === 'pending' || r.status === 'reviewed') && (
                  <>
                    <Textarea
                      rows={2}
                      placeholder="A note back — what you told them, what you agreed"
                      value={notes[r.id] ?? r.rancher_notes ?? ''}
                      onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))}
                    />
                    <div className="flex flex-wrap gap-2">
                      {r.status === 'pending' && (
                        <Button intent="secondary" size="sm" loading={saving[r.id]}
                                onClick={() => setStatus(r, 'reviewed')}>
                          MARK SEEN
                        </Button>
                      )}
                      <Button intent="primary" size="sm" loading={saving[r.id]}
                              onClick={() => setStatus(r, 'completed')}>
                        DONE
                      </Button>
                      <Button intent="ghost" size="sm" loading={saving[r.id]}
                              onClick={() => setStatus(r, 'declined')}>
                        DECLINE
                      </Button>
                      <Link href={`/messages`} className="ml-auto self-center type-helper"
                            style={{ color: 'var(--accent)' }}>
                        Message {r.owner_name} →
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </PageContainer>
  )
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="type-metric-label">{label}</dt>
      <dd className="text-sm mt-0.5" style={{ color: value ? 'var(--text)' : 'var(--text-muted)' }}>
        {value ?? '—'}
      </dd>
    </div>
  )
}
