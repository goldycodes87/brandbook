'use client'

import { useState, useEffect, useRef, use, useCallback } from 'react'
import { fmtDate, fmtMoney, fmtTs, calcAge } from '@/lib/format'

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
  photos: string[] | null
  dob: string | null
}

interface AnimalDetail {
  animal: {
    id: string
    tag_number: string
    name: string | null
    sex: string | null
    breed: string | null
    dob: string | null
    status: string
    origin: string | null
    purchase_price: number | null
    purchase_date: string | null
    photos: string[]
    dam_id: string | null
    sire_id: string | null
  }
  dam: { tag_number: string; name: string | null } | null
  sire: { tag_number: string; name: string | null } | null
  reproduction_events: {
    id: string
    event_type: string | null
    event_date: string | null
    conception_method: string | null
    sire_name_text: string | null
    expected_calving_date: string | null
    preg_check_result: string | null
    calving_ease_score: number | null
    weaning_date: string | null
    weaning_weight_lbs: number | null
  }[]
  health_events: {
    id: string
    event_type: string | null
    event_date: string | null
    drug_name: string | null
    dose_amount: number | null
    dose_unit: string | null
    bcs_score: number | null
    notes: string | null
  }[]
  reminders: {
    id: string
    reminder_type: string | null
    title: string | null
    due_date: string
    is_dismissed: boolean | null
  }[]
  current_pasture: { property_name: string; start_date: string } | null
  cost_basis: {
    base_cost: number
    breeding_costs: number
    grazing_costs: number
    animal_expense_costs: number
    total_invested: number
    breakdown: {
      purchase_price: number
      ai_semen_costs: number
      embryo_implant: number
      grazing: number
      animal_expenses: number
    }
  }
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

interface Message {
  id: string
  direction: 'owner_to_rancher' | 'rancher_to_owner'
  body: string
  read_at: string | null
  created_at: string
}

interface OwnerRequest {
  id: string
  request_type: 'buy' | 'sell'
  status: string
  quantity: number | null
  animal_type: string | null
  budget_min: number | null
  budget_max: number | null
  breed: string | null
  timeframe: string | null
  animal_id: string | null
  sell_reason: string | null
  sell_timeline: string | null
  funds_disposition: string | null
  notes: string | null
  rancher_notes: string | null
  created_at: string
}

interface AllocationReport {
  quarter: number
  year: number
  rows: {
    expense_id: string
    description: string
    category_name: string | null
    expense_date: string | null
    lease_name: string | null
    kind: string
    expense_total: number
    amount: number
    share_note: string | null
    status: 'pending' | 'invoiced' | 'paid'
    invoice_number: string | null
  }[]
  totals: { pending: number; invoiced: number; paid: number; total: number }
}

type Tab = 'portfolio' | 'animals' | 'messages' | 'more'

// ─── Helpers ───────────────────────────────────────────────────────────────

function getPhotoUrl(photos: string[] | null | undefined): string | null {
  if (!photos || photos.length === 0) return null
  return photos[0]
}

function statusDot(status: string) {
  const color = status === 'active' ? '#22c55e' : status === 'sold' ? '#f59e0b' : '#6b7280'
  return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', backgroundColor: color, marginRight: 4 }} />
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    pending:   { bg: '#fef3c7', fg: '#d97706' },
    reviewed:  { bg: '#dbeafe', fg: '#2563eb' },
    completed: { bg: '#dcfce7', fg: '#16a34a' },
    declined:  { bg: '#fee2e2', fg: '#dc2626' },
  }
  const colors = map[status] ?? { bg: 'var(--surface-2)', fg: 'var(--text-muted)' }
  return (
    <span style={{ background: colors.bg, color: colors.fg, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {status}
    </span>
  )
}

// ─── Icons (inline SVG) ────────────────────────────────────────────────────

function IconHome() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function IconAnimals() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <line x1="12" y1="12" x2="12" y2="16" />
      <line x1="10" y1="14" x2="14" y2="14" />
    </svg>
  )
}

function IconMessages() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function IconMore() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconX() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function IconPin() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function IconChevronDown({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// ─── Drawer ────────────────────────────────────────────────────────────────

function AnimalDrawer({ animalId, onClose }: { animalId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<AnimalDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [costOpen, setCostOpen] = useState(false)

  useEffect(() => {
    fetch(`/api/portals/owner/animals/${animalId}`)
      .then(r => r.json())
      .then(d => { setDetail(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [animalId])

  const a = detail?.animal
  const photoUrl = getPhotoUrl(a?.photos)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.55)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--surface-0)',
          borderRadius: '20px 20px 0 0',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUp 0.25s ease-out',
        }}
      >
        {/* Handle + close */}
        <div style={{ position: 'relative', padding: '12px 16px 0', textAlign: 'center' }}>
          <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 99, margin: '0 auto 8px' }} />
          <button
            onClick={onClose}
            style={{
              position: 'absolute', right: 16, top: 12,
              background: 'var(--surface-2)', border: 'none', cursor: 'pointer',
              borderRadius: '50%', width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <IconX />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 0 40px' }}>
          {loading && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ width: 28, height: 28, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
            </div>
          )}

          {!loading && !detail && (
            <p style={{ padding: 24, color: 'var(--text-muted)', textAlign: 'center' }}>Failed to load animal details.</p>
          )}

          {!loading && detail && a && (
            <>
              {/* Photo */}
              {photoUrl ? (
                <div style={{ width: '100%', aspectRatio: '4/3', background: 'var(--surface-2)', overflow: 'hidden' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoUrl} alt={`#${a.tag_number}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ) : (
                <div style={{ width: '100%', aspectRatio: '4/3', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60 }}>
                  🐄
                </div>
              )}

              <div style={{ padding: '20px 20px 0' }}>
                {/* Header */}
                <div style={{ marginBottom: 20 }}>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                    #{a.tag_number}
                  </h2>
                  {a.name && <p style={{ color: 'var(--text-muted)', marginTop: 2 }}>{a.name}</p>}
                  <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {statusDot(a.status)}
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.status}</span>
                  </div>
                </div>

                {/* Info grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginBottom: 20 }}>
                  {[
                    { label: 'Age', value: calcAge(a.dob) },
                    { label: 'Sex', value: a.sex ?? '—' },
                    { label: 'Breed', value: a.breed ?? '—' },
                    { label: 'DOB', value: fmtDate(a.dob) },
                    ...(a.purchase_date ? [{ label: 'Purchase Date', value: fmtDate(a.purchase_date) }] : []),
                    ...(a.purchase_price ? [{ label: 'Purchase Price', value: fmtMoney(a.purchase_price) }] : []),
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</p>
                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', textTransform: label === 'Sex' || label === 'Breed' ? 'capitalize' : 'none' }}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Sire / Dam */}
                {(detail.sire || detail.dam) && (
                  <div style={{ marginBottom: 20, padding: '12px 14px', background: 'var(--surface-1)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    {detail.sire && (
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: detail.dam ? 4 : 0 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>Sire: </span>
                        #{detail.sire.tag_number}{detail.sire.name ? ` — ${detail.sire.name}` : ''}
                      </p>
                    )}
                    {detail.dam && (
                      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>Dam: </span>
                        #{detail.dam.tag_number}{detail.dam.name ? ` — ${detail.dam.name}` : ''}
                      </p>
                    )}
                  </div>
                )}

                {/* Current Pasture */}
                {detail.current_pasture && (
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Current Pasture</p>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'var(--surface-2)', borderRadius: 99, border: '1px solid var(--border)' }}>
                      <IconPin />
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{detail.current_pasture.property_name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>since {fmtDate(detail.current_pasture.start_date)}</span>
                    </div>
                  </div>
                )}

                {/* Upcoming Reminders */}
                {detail.reminders.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Upcoming</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {detail.reminders.map(r => (
                        <div key={r.id} style={{ padding: '10px 14px', background: 'var(--surface-1)', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{r.title ?? r.reminder_type}</p>
                          <p style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{fmtDate(r.due_date)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Breeding History */}
                {detail.reproduction_events.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Breeding History</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {detail.reproduction_events.slice(0, 5).map(r => (
                        <div key={r.id} style={{ padding: '10px 14px', background: 'var(--surface-1)', borderRadius: 10, border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{r.event_type?.replace(/_/g, ' ')}</p>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(r.event_date)}</p>
                          </div>
                          {r.sire_name_text && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Sire: {r.sire_name_text}</p>}
                          {r.preg_check_result && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Preg check: {r.preg_check_result}</p>}
                          {r.expected_calving_date && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Expected calving: {fmtDate(r.expected_calving_date)}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Health Events */}
                {detail.health_events.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Recent Health Events</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {detail.health_events.slice(0, 3).map(h => (
                        <div key={h.id} style={{ padding: '10px 14px', background: 'var(--surface-1)', borderRadius: 10, border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{h.event_type?.replace(/_/g, ' ')}</p>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(h.event_date)}</p>
                          </div>
                          {h.drug_name && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{h.drug_name}{h.dose_amount ? ` · ${h.dose_amount}${h.dose_unit ?? ''}` : ''}</p>}
                          {h.bcs_score && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>BCS: {h.bcs_score}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cost Breakdown (collapsible) */}
                <div style={{ marginBottom: 20 }}>
                  <button
                    onClick={() => setCostOpen(o => !o)}
                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--surface-1)', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Cost Breakdown</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{fmtMoney(detail.cost_basis.total_invested)}</span>
                      <IconChevronDown open={costOpen} />
                    </div>
                  </button>
                  {costOpen && (
                    <div style={{ padding: '12px 14px', background: 'var(--surface-1)', borderTop: '1px solid var(--border)', borderRadius: '0 0 10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        { label: 'Purchase Price', value: detail.cost_basis.breakdown.purchase_price },
                        { label: 'AI / Semen Costs', value: detail.cost_basis.breakdown.ai_semen_costs },
                        { label: 'Embryo / Implant', value: detail.cost_basis.breakdown.embryo_implant },
                        { label: 'Grazing', value: detail.cost_basis.breakdown.grazing },
                        { label: 'Animal Expenses', value: detail.cost_basis.breakdown.animal_expenses },
                      ].filter(row => row.value > 0).map(row => (
                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{row.label}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{fmtMoney(row.value)}</span>
                        </div>
                      ))}
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Total Invested</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{fmtMoney(detail.cost_basis.total_invested)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ─── Buy Request Sheet ──────────────────────────────────────────────────────

function BuySheet({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ quantity: 1, animal_type: 'Cow', budget_min: '', budget_max: '', breed: '', timeframe: 'now', notes: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const animalTypes = ['Cow', 'Pair', 'Heifer', 'Bull', 'Other']
  const timeframes = [{ value: 'now', label: 'Now' }, { value: '1_2_weeks', label: '1-2 Weeks' }, { value: '1_month_plus', label: '1 Month+' }]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/portals/owner/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_type: 'buy',
          quantity: form.quantity,
          animal_type: form.animal_type,
          budget_min: form.budget_min ? Number(form.budget_min) : null,
          budget_max: form.budget_max ? Number(form.budget_max) : null,
          breed: form.breed || null,
          timeframe: form.timeframe,
          notes: form.notes || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed'); return }
      onSuccess()
    } catch {
      setError('Connection error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <BottomSheet title="BUY REQUEST" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Quantity */}
        <div>
          <label style={labelStyle}>Quantity</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" onClick={() => setForm(f => ({ ...f, quantity: Math.max(1, f.quantity - 1) }))} style={stepperBtn}>−</button>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', minWidth: 32, textAlign: 'center' }}>{form.quantity}</span>
            <button type="button" onClick={() => setForm(f => ({ ...f, quantity: f.quantity + 1 }))} style={stepperBtn}>+</button>
          </div>
        </div>

        {/* Animal type */}
        <div>
          <label style={labelStyle}>Type</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {animalTypes.map(t => (
              <button key={t} type="button" onClick={() => setForm(f => ({ ...f, animal_type: t }))}
                style={{ ...chipBtn, ...(form.animal_type === t ? chipActive : {}) }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Budget */}
        <div>
          <label style={labelStyle}>Budget (optional)</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="number" placeholder="Min $" value={form.budget_min} onChange={e => setForm(f => ({ ...f, budget_min: e.target.value }))} style={inputStyle} />
            <span style={{ color: 'var(--text-muted)' }}>–</span>
            <input type="number" placeholder="Max $" value={form.budget_max} onChange={e => setForm(f => ({ ...f, budget_max: e.target.value }))} style={inputStyle} />
          </div>
        </div>

        {/* Breed */}
        <div>
          <label style={labelStyle}>Breed (optional)</label>
          <input type="text" placeholder="Any breed" value={form.breed} onChange={e => setForm(f => ({ ...f, breed: e.target.value }))} style={{ ...inputStyle, width: '100%' }} />
        </div>

        {/* Timeframe */}
        <div>
          <label style={labelStyle}>Timeframe</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {timeframes.map(t => (
              <button key={t.value} type="button" onClick={() => setForm(f => ({ ...f, timeframe: t.value }))}
                style={{ ...chipBtn, ...(form.timeframe === t.value ? chipActive : {}), flex: 1 }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label style={labelStyle}>Notes (optional)</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Any additional details…" style={{ ...inputStyle, width: '100%', resize: 'vertical' }} />
        </div>

        {error && <p style={{ fontSize: 13, color: 'var(--danger-fg, #dc2626)' }}>{error}</p>}

        <button type="submit" disabled={submitting} style={submitBtn}>
          {submitting ? 'SUBMITTING…' : 'SUBMIT BUY REQUEST'}
        </button>
      </form>
    </BottomSheet>
  )
}

// ─── Sell Request Sheet ─────────────────────────────────────────────────────

function SellSheet({ animals, onClose, onSuccess }: { animals: Animal[]; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ animal_id: '', sell_reason: '', sell_timeline: 'asap', funds_disposition: 'send_minus_fee', funds_other_notes: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const timelines = [{ value: 'asap', label: 'ASAP' }, { value: '1_2_weeks', label: '1-2 Weeks' }, { value: '1_month_plus', label: '1 Month+' }]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.animal_id) { setError('Please select an animal'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/portals/owner/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_type: 'sell',
          animal_id: form.animal_id,
          sell_reason: form.sell_reason,
          sell_timeline: form.sell_timeline,
          funds_disposition: form.funds_disposition,
          funds_other_notes: form.funds_disposition === 'other' ? (form.funds_other_notes || null) : null,
          notes: form.notes || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed'); return }
      onSuccess()
    } catch {
      setError('Connection error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <BottomSheet title="SELL REQUEST" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Animal selector */}
        <div>
          <label style={labelStyle}>Select Animal</label>
          <select value={form.animal_id} onChange={e => setForm(f => ({ ...f, animal_id: e.target.value }))} style={{ ...inputStyle, width: '100%' }} required>
            <option value="">Choose an animal…</option>
            {animals.filter(a => a.status === 'active').map(a => (
              <option key={a.id} value={a.id}>#{a.tag_number}{a.name ? ` — ${a.name}` : ''}</option>
            ))}
          </select>
        </div>

        {/* Reason */}
        <div>
          <label style={labelStyle}>Reason for Selling</label>
          <textarea value={form.sell_reason} onChange={e => setForm(f => ({ ...f, sell_reason: e.target.value }))} rows={3} placeholder="Why are you looking to sell this animal?" style={{ ...inputStyle, width: '100%', resize: 'vertical' }} required />
        </div>

        {/* Timeline */}
        <div>
          <label style={labelStyle}>Timeline</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {timelines.map(t => (
              <button key={t.value} type="button" onClick={() => setForm(f => ({ ...f, sell_timeline: t.value }))}
                style={{ ...chipBtn, ...(form.sell_timeline === t.value ? chipActive : {}), flex: 1 }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Funds disposition */}
        <div>
          <label style={labelStyle}>What to do with funds</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { value: 'send_minus_fee', label: 'Send me payment (minus selling fee)' },
              { value: 'keep_for_purchase', label: 'Keep in account to buy something else' },
              { value: 'other', label: 'Other' },
            ].map(opt => (
              <label key={opt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                <input type="radio" name="funds" value={opt.value} checked={form.funds_disposition === opt.value} onChange={() => setForm(f => ({ ...f, funds_disposition: opt.value }))} style={{ marginTop: 2 }} />
                <span style={{ fontSize: 14, color: 'var(--text)' }}>{opt.label}</span>
              </label>
            ))}
            {form.funds_disposition === 'other' && (
              <textarea value={form.funds_other_notes} onChange={e => setForm(f => ({ ...f, funds_other_notes: e.target.value }))} rows={2} placeholder="Describe what you'd like done…" style={{ ...inputStyle, width: '100%', resize: 'vertical' }} />
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label style={labelStyle}>Additional Notes (optional)</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Anything else…" style={{ ...inputStyle, width: '100%', resize: 'vertical' }} />
        </div>

        {error && <p style={{ fontSize: 13, color: 'var(--danger-fg, #dc2626)' }}>{error}</p>}

        <button type="submit" disabled={submitting} style={submitBtn}>
          {submitting ? 'SUBMITTING…' : 'SUBMIT SELL REQUEST'}
        </button>
      </form>
    </BottomSheet>
  )
}

// ─── Generic Bottom Sheet ───────────────────────────────────────────────────

function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--surface-0)', borderRadius: '20px 20px 0 0', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'slideUp 0.25s ease-out' }}>
        <div style={{ padding: '14px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '0.03em' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'var(--surface-2)', border: 'none', cursor: 'pointer', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <IconX />
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: 20 }}>{children}</div>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  )
}

// ─── Shared styles ──────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }
const inputStyle: React.CSSProperties = { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-1)', color: 'var(--text)', fontSize: 14 }
const chipBtn: React.CSSProperties = { padding: '8px 14px', borderRadius: 99, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const chipActive: React.CSSProperties = { background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' }
const stepperBtn: React.CSSProperties = { width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const submitBtn: React.CSSProperties = { padding: '14px', borderRadius: 10, background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14, letterSpacing: '0.05em', border: 'none', cursor: 'pointer', width: '100%' }

// ─── Page ──────────────────────────────────────────────────────────────────

export default function OwnerPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [valid, setValid]         = useState<boolean | null>(null)
  const [owner, setOwner]         = useState<OwnerInfo | null>(null)
  const [animals, setAnimals]     = useState<Animal[]>([])
  const [invoices, setInvoices]   = useState<Invoice[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [messages, setMessages]   = useState<Message[]>([])
  const [requests, setRequests]   = useState<OwnerRequest[]>([])
  const [alloc, setAlloc]         = useState<AllocationReport | null>(null)
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState<Tab>('portfolio')

  // Animal drawer
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null)

  // Messages
  const [msgBody, setMsgBody]     = useState('')
  const [sending, setSending]     = useState(false)
  const msgBottomRef              = useRef<HTMLDivElement>(null)

  // Sheets
  const [buyOpen, setBuyOpen]     = useState(false)
  const [sellOpen, setSellOpen]   = useState(false)

  // Annual report
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [reportLoading, setReportLoading] = useState(false)

  // Expenses
  const nowQ = Math.ceil((new Date().getMonth() + 1) / 3)
  const [allocQuarter, setAllocQuarter] = useState(nowQ)
  const [allocYear, setAllocYear] = useState(new Date().getFullYear() % 100)

  // Load messages on messages tab
  const loadMessages = useCallback(async () => {
    const res = await fetch('/api/portals/owner/messages')
    const d = await res.json()
    setMessages(d.data ?? [])
  }, [])

  const loadRequests = useCallback(async () => {
    const res = await fetch('/api/portals/owner/requests')
    const d = await res.json()
    setRequests(d.data ?? [])
  }, [])

  useEffect(() => {
    fetch('/api/portals/owner/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(async d => {
        if (!d.ok) { setValid(false); setLoading(false); return }
        setOwner(d.owner)
        setValid(true)

        const [animRes, invRes, settleRes] = await Promise.all([
          fetch('/api/portals/owner/animals').then(r => r.json()),
          fetch('/api/portals/owner/invoices').then(r => r.json()),
          fetch('/api/portals/owner/settlement').then(r => r.json()),
        ])
        setAnimals(animRes.data ?? [])
        setInvoices(invRes.data ?? [])
        setSettlements(settleRes.data ?? [])
        setLoading(false)

        // Load current quarter allocations for portfolio hero
        const allocRes = await fetch(`/api/portals/owner/allocations?year=${new Date().getFullYear() % 100}&quarter=${Math.ceil((new Date().getMonth() + 1) / 3)}`)
        const allocData = await allocRes.json()
        if (!allocData.error) setAlloc(allocData)
      })
      .catch(() => { setValid(false); setLoading(false) })
  }, [token])

  useEffect(() => {
    if (!valid || tab !== 'messages') return
    loadMessages()
  }, [valid, tab, loadMessages])

  useEffect(() => {
    if (!valid || tab !== 'more') return
    loadRequests()
  }, [valid, tab, loadRequests])

  useEffect(() => {
    if (tab === 'messages') {
      setTimeout(() => msgBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }, [messages, tab])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!msgBody.trim()) return
    setSending(true)
    try {
      await fetch('/api/portals/owner/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: msgBody.trim() }),
      })
      setMsgBody('')
      loadMessages()
    } finally {
      setSending(false)
    }
  }

  const handleGenerateReport = async () => {
    setReportLoading(true)
    try {
      const res = await fetch('/api/portals/owner/annual-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: selectedYear }),
      })
      const data = await res.json()
      if (data.pdf_url) {
        window.open(data.pdf_url, '_blank')
        const settleRes = await fetch('/api/portals/owner/settlement').then(r => r.json())
        setSettlements(settleRes.data ?? [])
      }
    } finally {
      setReportLoading(false)
    }
  }

  // ─── Loading / Invalid states ──────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--surface-0)' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!valid) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'var(--surface-0)' }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 0, lineHeight: 1, marginBottom: 16 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, color: 'var(--accent)' }}>BRAND</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 400, color: 'var(--text)' }}>BOOK</span>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            This link is invalid or has expired. Contact your ranch for a new link.
          </p>
        </div>
      </div>
    )
  }

  // ─── Computed stats for portfolio ──────────────────────────────────────

  const totalInvested = animals.reduce((sum, _) => sum, 0) // rough placeholder; full sum via cost-basis
  const unpaidInvoices = invoices.filter(i => i.status !== 'paid')
  const pendingTotal = alloc?.totals.pending ?? 0

  const BOTTOM_TABS: { value: Tab; label: string; icon: React.ReactNode }[] = [
    { value: 'portfolio', label: 'Portfolio', icon: <IconHome /> },
    { value: 'animals',   label: 'Animals',   icon: <IconAnimals /> },
    { value: 'messages',  label: 'Messages',  icon: <IconMessages /> },
    { value: 'more',      label: 'More',      icon: <IconMore /> },
  ]

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: 'var(--surface-0)', display: 'flex', flexDirection: 'column' }}>

      {/* Sticky top header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 20, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--surface-1)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0, lineHeight: 1 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent)' }}>BRAND</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 400, color: 'var(--text)' }}>BOOK</span>
        </div>
        {/* Avatar */}
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>
          {(owner?.name?.[0] ?? '?').toUpperCase()}
        </div>
      </header>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>

        {/* ── PORTFOLIO TAB ───────────────────────────────── */}
        {tab === 'portfolio' && (
          <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 600, margin: '0 auto' }}>
            {/* Hero card */}
            <div style={{ borderRadius: 16, padding: '24px 20px', background: 'linear-gradient(135deg, #1a1a1a 0%, #2d1b0e 100%)', color: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.55)', marginBottom: 6, textTransform: 'uppercase' }}>MY HERD — TOTAL COST BASIS</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1, color: '#fff' }}>
                {animals.length > 0 ? `${animals.length} head` : '—'}
              </p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
                {owner?.name}
              </p>
            </div>

            {/* Stat chips row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { label: 'ANIMALS', value: animals.length },
                { label: 'THIS QTR', value: pendingTotal > 0 ? fmtMoney(pendingTotal) : '$0' },
                { label: 'INVOICES', value: unpaidInvoices.length },
              ].map(s => (
                <div key={s.label} style={{ padding: '12px 10px', borderRadius: 12, background: 'var(--surface-1)', border: '1px solid var(--border)', textAlign: 'center' }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 4 }}>{s.label}</p>
                  <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Upcoming events — reminders from allocations or just list top reminders */}
            {invoices.length > 0 && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Recent Activity</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {invoices.slice(0, 3).map(inv => (
                    <div key={inv.id} style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--surface-1)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Invoice {inv.invoice_number}</p>
                        {inv.due_date && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Due {fmtDate(inv.due_date)}</p>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: inv.status === 'paid' ? '#22c55e' : 'var(--accent)' }}>{fmtMoney(inv.total_amount)}</p>
                        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{inv.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {animals.length === 0 && invoices.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>🐄</p>
                <p style={{ fontSize: 14 }}>No animals assigned yet. Contact your ranch.</p>
              </div>
            )}
          </div>
        )}

        {/* ── ANIMALS TAB ─────────────────────────────────── */}
        {tab === 'animals' && (
          <div style={{ padding: '16px', maxWidth: 700, margin: '0 auto' }}>
            {animals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: 40, marginBottom: 8 }}>🐄</p>
                <p>No animals assigned to your account.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {animals.map(a => {
                  const photoUrl = getPhotoUrl(a.photos)
                  return (
                    <button
                      key={a.id}
                      onClick={() => setSelectedAnimalId(a.id)}
                      style={{ background: 'var(--surface-1)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                    >
                      {/* Photo */}
                      <div style={{ aspectRatio: '1/1', background: 'var(--surface-2)', overflow: 'hidden', position: 'relative' }}>
                        {photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={photoUrl} alt={`#${a.tag_number}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>🐄</div>
                        )}
                      </div>
                      {/* Info */}
                      <div style={{ padding: '10px 12px 12px' }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>#{a.tag_number}</p>
                        {a.name && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{a.name}</p>}
                        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {[a.sex, a.breed].filter(Boolean).map(s => s![0].toUpperCase() + s!.slice(1)).join(' · ')}
                        </p>
                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center' }}>
                          {statusDot(a.status)}
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{a.status}</span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── MESSAGES TAB ────────────────────────────────── */}
        {tab === 'messages' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 120px)', maxWidth: 600, margin: '0 auto', width: '100%' }}>
            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: 24, marginBottom: 8 }}>💬</p>
                  <p>No messages yet. Start a conversation below.</p>
                </div>
              )}
              {messages.map(msg => {
                const isOwner = msg.direction === 'owner_to_rancher'
                return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: isOwner ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '80%' }}>
                      <div style={{
                        padding: '10px 14px',
                        borderRadius: isOwner ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: isOwner ? 'var(--accent)' : 'var(--surface-2)',
                        color: isOwner ? '#fff' : 'var(--text)',
                        fontSize: 14,
                        lineHeight: 1.5,
                      }}>
                        {msg.body}
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, textAlign: isOwner ? 'right' : 'left' }}>
                        {fmtTs(msg.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={msgBottomRef} />
            </div>

            {/* Send form */}
            <div style={{ padding: '8px 16px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface-0)' }}>
              <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <textarea
                  value={msgBody}
                  onChange={e => setMsgBody(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e) } }}
                  rows={2}
                  placeholder="Type a message…"
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-1)', color: 'var(--text)', fontSize: 14, resize: 'none' }}
                />
                <button type="submit" disabled={sending || !msgBody.trim()} style={{ padding: '10px 18px', borderRadius: 12, background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', opacity: (sending || !msgBody.trim()) ? 0.6 : 1 }}>
                  {sending ? '…' : 'SEND'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── MORE TAB ─────────────────────────────────────── */}
        {tab === 'more' && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600, margin: '0 auto' }}>

            {/* Quick actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => setBuyOpen(true)} style={{ padding: '16px 12px', borderRadius: 14, background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: '0.04em', border: 'none', cursor: 'pointer', textAlign: 'center' }}>
                + BUY REQUEST
              </button>
              <button onClick={() => setSellOpen(true)} style={{ padding: '16px 12px', borderRadius: 14, background: 'var(--surface-2)', color: 'var(--text)', fontWeight: 700, fontSize: 13, letterSpacing: '0.04em', border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'center' }}>
                SELL REQUEST
              </button>
            </div>

            {/* My Invoices */}
            <MoreSection title="MY INVOICES">
              {invoices.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>No invoices yet.</p>
              ) : (
                invoices.map(inv => (
                  <div key={inv.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{inv.invoice_number}</p>
                      {inv.due_date && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Due {fmtDate(inv.due_date)}</p>}
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: inv.status === 'paid' ? '#22c55e' : 'var(--accent)' }}>{fmtMoney(inv.total_amount)}</span>
                      <StatusBadge status={inv.status} />
                      {inv.pdf_url && (
                        <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>Download PDF</a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </MoreSection>

            {/* My Requests */}
            <MoreSection title="MY REQUESTS">
              {requests.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>No requests submitted yet.</p>
              ) : (
                requests.map(r => (
                  <div key={r.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase' }}>{r.request_type} Request</p>
                        {r.request_type === 'buy' && r.quantity && (
                          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{r.quantity} {r.animal_type} · {r.timeframe?.replace(/_/g, ' ')}</p>
                        )}
                        {r.request_type === 'sell' && r.sell_timeline && (
                          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Timeline: {r.sell_timeline}</p>
                        )}
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{fmtDate(r.created_at)}</p>
                        {r.rancher_notes && (
                          <p style={{ fontSize: 12, color: 'var(--text)', marginTop: 4, fontStyle: 'italic' }}>Ranch note: {r.rancher_notes}</p>
                        )}
                      </div>
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                ))
              )}
            </MoreSection>

            {/* Annual Report */}
            <MoreSection title="ANNUAL REPORT">
              {(() => {
                const years = settlements.length > 0
                  ? [...new Set(settlements.map(s => s.settlement_year))].sort((a, b) => b - a)
                  : [new Date().getFullYear()]
                const yearSettlement = settlements.find(s => s.settlement_year === selectedYear) ?? null
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {years.map(y => (
                        <button key={y} type="button" onClick={() => setSelectedYear(y)}
                          style={{ ...chipBtn, ...(selectedYear === y ? chipActive : {}) }}>
                          {y}
                        </button>
                      ))}
                    </div>
                    {yearSettlement?.pdf_url ? (
                      <a href={yearSettlement.pdf_url} target="_blank" rel="noopener noreferrer"
                        style={{ ...submitBtn, display: 'block', textAlign: 'center', textDecoration: 'none' }}>
                        DOWNLOAD {selectedYear} REPORT
                      </a>
                    ) : (
                      <button type="button" onClick={handleGenerateReport} disabled={reportLoading}
                        style={{ ...submitBtn, opacity: reportLoading ? 0.6 : 1 }}>
                        {reportLoading ? 'GENERATING…' : `GENERATE ${selectedYear} REPORT`}
                      </button>
                    )}
                  </div>
                )
              })()}
            </MoreSection>

            {/* Quarterly Expenses */}
            <MoreSection title="MY EXPENSES">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {[1, 2, 3, 4].map(q => (
                  <button key={q} type="button" onClick={() => setAllocQuarter(q)}
                    style={{ ...chipBtn, ...(allocQuarter === q ? chipActive : {}) }}>
                    Q{q}
                  </button>
                ))}
                <select value={allocYear} onChange={e => setAllocYear(Number(e.target.value))}
                  style={{ ...inputStyle, fontSize: 13, padding: '6px 10px' }}>
                  {[0, 1, 2].map(back => {
                    const y = (new Date().getFullYear() - back) % 100
                    return <option key={y} value={y}>20{String(y).padStart(2, '0')}</option>
                  })}
                </select>
              </div>
              {alloc && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[['PENDING', alloc.totals.pending, '#d97706'], ['INVOICED', alloc.totals.invoiced, 'var(--text)'], ['PAID', alloc.totals.paid, '#22c55e']] .map(([label, value, color]) => (
                    <div key={label as string} style={{ padding: '10px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', textAlign: 'center' }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: color as string }}>{fmtMoney(value as number)}</p>
                    </div>
                  ))}
                </div>
              )}
            </MoreSection>
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20, display: 'flex', background: 'var(--surface-1)', borderTop: '1px solid var(--border)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {BOTTOM_TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            style={{
              flex: 1, padding: '8px 4px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              background: 'none', border: 'none', cursor: 'pointer',
              color: tab === t.value ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            {t.icon}
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em' }}>{t.label}</span>
          </button>
        ))}
      </nav>

      {/* Animal drawer */}
      {selectedAnimalId && (
        <AnimalDrawer
          animalId={selectedAnimalId}
          onClose={() => setSelectedAnimalId(null)}
        />
      )}

      {/* Buy / Sell sheets */}
      {buyOpen && (
        <BuySheet
          onClose={() => setBuyOpen(false)}
          onSuccess={() => { setBuyOpen(false); loadRequests() }}
        />
      )}
      {sellOpen && (
        <SellSheet
          animals={animals}
          onClose={() => setSellOpen(false)}
          onSuccess={() => { setSellOpen(false); loadRequests() }}
        />
      )}

      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

function MoreSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface-1)', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{title}</p>
      </div>
      <div style={{ padding: '4px 16px 12px' }}>
        {children}
      </div>
    </div>
  )
}
