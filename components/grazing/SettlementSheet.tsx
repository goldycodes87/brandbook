'use client'

import { useState, useEffect } from 'react'
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { apiPost, apiGet } from '@/lib/fetch'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GrazingContract {
  id: string
  calf_share_pct: number | null
  calf_share_rounding: string | null
  carry_forward_shortfall: boolean | null
  calf_shortfall_carried: number | null
  death_loss_allowable_pct: number | null
  death_loss_split_threshold_pct: number | null
  sale_fee_auction_pct: number | null
  sale_fee_private_flat: number | null
  rate_per_head_month: number | null
}

interface SettlementSheetProps {
  ownerId: string
  ownerName: string
  contract: GrazingContract | null
  onClose: () => void
  onSaved: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v)
}

function calcShare(calves: number, pct: number, rounding: string | null): number {
  const raw = calves * pct / 100
  if (rounding === 'up') return Math.ceil(raw)
  if (rounding === 'nearest') return Math.round(raw)
  return Math.floor(raw)
}

function deathLossResponsibility(
  pct: number,
  allowable: number,
  splitThreshold: number
): 'owner' | 'split' | 'operator' {
  if (pct <= allowable) return 'owner'
  if (pct <= splitThreshold) return 'split'
  return 'operator'
}

// ─── Step components ──────────────────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5 justify-center" style={{ marginBottom: '20px' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? '20px' : '6px',
            height: '6px',
            borderRadius: '3px',
            backgroundColor: i === current ? 'var(--accent)' : 'var(--border)',
            transition: 'all 0.2s',
          }}
        />
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SettlementSheet({ ownerId, ownerName, contract, onClose, onSaved }: SettlementSheetProps) {
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const currentYear = new Date().getFullYear()

  // Step 1 — Calf crop
  const [calfsBorn,   setCalfsBorn]   = useState('')
  const [calvsDied,   setCalvsDied]   = useState('')
  const [calvWean,    setCalvWean]    = useState('')
  const [deadFmv,     setDeadFmv]     = useState('')

  // Step 2 — Calf share
  const [calfTransferFmv, setCalfTransferFmv] = useState('')

  // Step 3 — Sales
  const [grossSales,    setGrossSales]    = useState('')
  const [netProceeds,   setNetProceeds]   = useState('')
  const [saleFeesChgd, setSaleFeesChgd]  = useState('')

  // Step 4 — Grazing fees
  const [grazingFees,   setGrazingFees]   = useState('')
  const [expenseSplits, setExpenseSplits] = useState('')

  // Step 5 — Notes
  const [notes, setNotes] = useState('')

  const STEPS = 5

  // ── Live calcs ─────────────────────────────────────────────────────────────

  const born  = Number(calfsBorn) || 0
  const died  = Number(calvsDied) || 0
  const wean  = Number(calvWean)  || 0
  const dFmv  = Number(deadFmv)   || 0

  const deathLossPct = born > 0 ? Math.round((died / born) * 1000) / 10 : 0
  const allowable    = contract?.death_loss_allowable_pct      ?? 10
  const splitThr     = contract?.death_loss_split_threshold_pct ?? 25
  const dlResp       = deathLossResponsibility(deathLossPct, allowable, splitThr)

  const pct      = contract?.calf_share_pct ?? 0
  const rounding = contract?.calf_share_rounding ?? 'down'
  const rawShare = calcShare(wean, pct, rounding)

  const carried   = contract?.calf_shortfall_carried ?? 0
  const carryOn   = contract?.carry_forward_shortfall ?? false
  const adjShare  = carryOn && carried > 0 ? Math.min(rawShare + carried, wean) : rawShare
  const ownerCalv = wean - adjShare

  const dlBanner = dlResp === 'owner'
    ? `${deathLossPct}% ≤ ${allowable}% allowable — owner bears full loss`
    : dlResp === 'split'
      ? `${deathLossPct}% between ${allowable}%–${splitThr}% — 50/50 split`
      : `${deathLossPct}% > ${splitThr}% threshold — operator bears full loss`

  const opDlShare    = dlResp === 'operator' ? dFmv : dlResp === 'split' ? dFmv * 0.5 : 0
  const grazingTotal = (Number(grazingFees) || 0) + (Number(expenseSplits) || 0)
  const saleFeeCh    = Number(saleFeesChgd) || 0
  const netProc      = Number(netProceeds)  || 0
  const xferFmv      = Number(calfTransferFmv) || 0

  const rawBalance = grazingTotal + saleFeeCh + opDlShare - netProc - xferFmv
  const balToOp    = Math.max(0, rawBalance)
  const balToOwner = rawBalance < 0 ? Math.abs(rawBalance) : 0

  const handleSubmit = async () => {
    setSaving(true); setError('')
    try {
      const res = await apiPost(`/api/grazing-owners/${ownerId}/settlement`, {
        settlement_year:             currentYear,
        calves_born:                 born,
        calves_died:                 died,
        calves_weaned:               wean,
        dead_calf_fmv_total:         dFmv,
        gross_calf_sales:            Number(grossSales) || 0,
        net_calf_proceeds_to_owner:  netProc,
        grazing_fees_total:          Number(grazingFees) || 0,
        expense_splits_total:        Number(expenseSplits) || 0,
        sale_fees_charged:           saleFeeCh,
        calf_transfers_fmv:          xferFmv,
        settlement_notes:            notes || null,
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Save failed'); return }
      setSaved(true)
      setTimeout(() => onSaved(), 1400)
    } catch { setError('Connection error') }
    finally { setSaving(false) }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center md:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="rounded-t-[var(--radius-xl)] md:rounded-[var(--radius-xl)] w-full md:max-w-lg flex flex-col"
        style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)', maxHeight: '90dvh' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <p className="type-panel-title" style={{ margin: 0 }}>Generate Settlement</p>
            <p className="type-label" style={{ color: 'var(--text-muted)', margin: 0 }}>{ownerName} · {currentYear}</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain" style={{ padding: '20px' }}>
          {saved ? (
            <div className="py-8 text-center">
              <Check size={32} style={{ color: 'var(--success-fg)', margin: '0 auto 12px' }} />
              <p className="type-panel-title" style={{ color: 'var(--success-fg)' }}>Settlement saved!</p>
            </div>
          ) : (
            <>
              <StepDots current={step - 1} total={STEPS} />

              {/* ── Step 1: Calf Crop ── */}
              {step === 1 && (
                <div className="flex flex-col gap-4">
                  <p className="type-panel-title">1. Calf Crop</p>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Calves born">
                      <Input type="number" min={0} value={calfsBorn} onChange={e => setCalfsBorn(e.target.value)} placeholder="0" />
                    </Field>
                    <Field label="Calves died">
                      <Input type="number" min={0} value={calvsDied} onChange={e => setCalvsDied(e.target.value)} placeholder="0" />
                    </Field>
                    <Field label="Calves weaned">
                      <Input type="number" min={0} value={calvWean} onChange={e => setCalvWean(e.target.value)} placeholder="0" />
                    </Field>
                    <Field label="Dead calf FMV total ($)">
                      <Input type="number" min={0} value={deadFmv} onChange={e => setDeadFmv(e.target.value)} placeholder="0" />
                    </Field>
                  </div>
                  {born > 0 && died > 0 && (
                    <ContextBanner tone={dlResp === 'owner' ? 'success' : dlResp === 'split' ? 'warning' : 'danger'}>
                      Death loss: {deathLossPct}% — {dlBanner}
                    </ContextBanner>
                  )}
                </div>
              )}

              {/* ── Step 2: Calf Share ── */}
              {step === 2 && (
                <div className="flex flex-col gap-4">
                  <p className="type-panel-title">2. Calf Share</p>
                  {contract?.calf_share_pct != null ? (
                    <>
                      <ContextBanner tone="info">
                        Operator gets {pct}% of {wean} weaned = {rawShare} calves
                        {carryOn && carried > 0 ? ` + ${carried} shortfall = ${adjShare} adjusted` : ''}
                        {' '}(rounding: {rounding})
                      </ContextBanner>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Operator calves">
                          <Input disabled value={adjShare} readOnly />
                        </Field>
                        <Field label="Owner calves">
                          <Input disabled value={ownerCalv} readOnly />
                        </Field>
                      </div>
                      <Field label="Calf transfers FMV ($)" helper="Total FMV of calves transferred to operator">
                        <Input type="number" min={0} value={calfTransferFmv} onChange={e => setCalfTransferFmv(e.target.value)} placeholder="0" />
                      </Field>
                    </>
                  ) : (
                    <ContextBanner tone="info">No calf sharing in this contract — skip to next step.</ContextBanner>
                  )}
                </div>
              )}

              {/* ── Step 3: Sales ── */}
              {step === 3 && (
                <div className="flex flex-col gap-4">
                  <p className="type-panel-title">3. Calf Sales</p>
                  <div className="grid grid-cols-1 gap-4">
                    <Field label="Gross calf sales ($)">
                      <Input type="number" min={0} value={grossSales} onChange={e => setGrossSales(e.target.value)} placeholder="0" />
                    </Field>
                    <Field label="Net proceeds to owner ($)" helper="After commission and yardage">
                      <Input type="number" min={0} value={netProceeds} onChange={e => setNetProceeds(e.target.value)} placeholder="0" />
                    </Field>
                    <Field label="Sale fees charged to owner ($)">
                      <Input type="number" min={0} value={saleFeesChgd} onChange={e => setSaleFeesChgd(e.target.value)} placeholder="0" />
                    </Field>
                  </div>
                </div>
              )}

              {/* ── Step 4: Grazing Fees ── */}
              {step === 4 && (
                <div className="flex flex-col gap-4">
                  <p className="type-panel-title">4. Grazing Fees</p>
                  <div className="grid grid-cols-1 gap-4">
                    <Field label="Total grazing fees ($)">
                      <Input type="number" min={0} value={grazingFees} onChange={e => setGrazingFees(e.target.value)} placeholder="0" />
                    </Field>
                    <Field label="Shared expenses total ($)">
                      <Input type="number" min={0} value={expenseSplits} onChange={e => setExpenseSplits(e.target.value)} placeholder="0" />
                    </Field>
                  </div>
                </div>
              )}

              {/* ── Step 5: Summary ── */}
              {step === 5 && (
                <div className="flex flex-col gap-4">
                  <p className="type-panel-title">5. Settlement Summary</p>
                  <div
                    className="flex flex-col gap-2"
                    style={{
                      background: 'var(--surface-2)',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {[
                      ['Calves born / died / weaned', `${born} / ${died} / ${wean}`],
                      ['Death loss', `${deathLossPct}% (${dlResp})`],
                      ['Operator calf share', adjShare],
                      ['Owner calf share', ownerCalv],
                      ['Grazing fees', fmtMoney(Number(grazingFees) || 0)],
                      ['Expense splits', fmtMoney(Number(expenseSplits) || 0)],
                      ['Sale fees charged', fmtMoney(saleFeeCh)],
                      ['Net proceeds to owner', fmtMoney(netProc)],
                      ['Calf transfer FMV', fmtMoney(xferFmv)],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="flex justify-between">
                        <span className="type-label" style={{ color: 'var(--text-muted)' }}>{label}</span>
                        <span className="type-label" style={{ fontWeight: 600 }}>{value}</span>
                      </div>
                    ))}
                    <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0' }} />
                    {balToOp > 0 && (
                      <div className="flex justify-between">
                        <span className="type-label" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Balance due to operator</span>
                        <span className="type-label" style={{ fontWeight: 700, color: 'var(--success-fg)' }}>{fmtMoney(balToOp)}</span>
                      </div>
                    )}
                    {balToOwner > 0 && (
                      <div className="flex justify-between">
                        <span className="type-label" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Balance due to owner</span>
                        <span className="type-label" style={{ fontWeight: 700, color: 'var(--warning-fg, #d97706)' }}>{fmtMoney(balToOwner)}</span>
                      </div>
                    )}
                    {balToOp === 0 && balToOwner === 0 && (
                      <div className="flex justify-between">
                        <span className="type-label" style={{ fontWeight: 700 }}>Balance</span>
                        <span className="type-label" style={{ fontWeight: 700 }}>Even</span>
                      </div>
                    )}
                  </div>
                  <Field label="Settlement notes (optional)">
                    <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Any notes about this settlement…" />
                  </Field>
                  {error && (
                    <p className="type-label" style={{ color: 'var(--danger-fg)' }}>{error}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!saved && (
          <div
            className="flex items-center justify-between"
            style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}
          >
            <Button
              intent="ghost"
              size="sm"
              onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
              leading={<ChevronLeft size={14} />}
            >
              {step > 1 ? 'BACK' : 'CANCEL'}
            </Button>
            {step < STEPS ? (
              <Button
                intent="primary"
                size="sm"
                onClick={() => setStep(s => s + 1)}
                trailing={<ChevronRight size={14} />}
              >
                NEXT
              </Button>
            ) : (
              <Button
                intent="primary"
                size="sm"
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving ? 'SAVING…' : 'SAVE SETTLEMENT'}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
