'use client'

import { useState, useEffect } from 'react'
import { Panel, PanelSection } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Toggle'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { apiGet } from '@/lib/fetch'
import { SALE_FEES, applyFees, type AppliedFee } from '@/lib/sale-fees'

/**
 * What the sale fee checklist starts out at.
 *
 * These are starting points, not rules. Every one can be changed on the sale
 * itself, which is the whole reason the checklist exists — the point of this
 * screen is only that the common case should not need correcting every time.
 *
 * It prices a worked example as the rates are edited, because a percentage and
 * a per-head charge do not compare in the head until you see them against the
 * same sale.
 */

const HINT = new Map(SALE_FEES.map(f => [f.key, f.hint]))

const usd = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** The sale the preview prices: four head, a realistic barn load. */
const EG_GROSS = 6500
const EG_HEAD  = 4

function unit(f: AppliedFee) {
  switch (f.basis) {
    case 'pct_of_gross':      return '% of gross'
    case 'per_head':          return '$ per head'
    case 'min_plus_per_head': return '$ minimum'
    default:                  return '$ flat'
  }
}

export function SaleFeePanel({ canEdit = true }: { canEdit?: boolean }) {
  const [fees, setFees]           = useState<AppliedFee[] | null>(null)
  const [configured, setConfigured] = useState(false)
  const [dirty, setDirty]         = useState(false)
  const [saving, setSaving]       = useState(false)
  const [note, setNote]           = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    apiGet('/api/settings/sale-fees')
      .then(r => r.json())
      .then(d => { if (d.data) { setFees(d.data); setConfigured(Boolean(d.configured)) } })
      .catch(() => setError('Could not load the fee defaults.'))
  }, [])

  const set = (key: string, patch: Partial<AppliedFee>) => {
    // A CPA reaches this room to read the rates behind an invoice. The API
    // says the same thing, so this is a courtesy to the eye, not the gate.
    if (!canEdit) return
    setFees(prev => (prev ?? []).map(f => (f.key === key ? { ...f, ...patch } : f)))
    setDirty(true)
    setNote(null)
  }

  const save = async () => {
    if (!fees) return
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/settings/sale-fees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fees }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'That did not save.'); return }
      setFees(d.data); setConfigured(true); setDirty(false)
      setNote('Saved. New sales start from these.')
    } catch {
      setError('Connection error.')
    } finally {
      setSaving(false)
    }
  }

  const reset = async () => {
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/settings/sale-fees', { method: 'DELETE' })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'That did not reset.'); return }
      setFees(d.data); setConfigured(false); setDirty(false)
      setNote('Back to the figures the app shipped with.')
    } catch {
      setError('Connection error.')
    } finally {
      setSaving(false)
    }
  }

  if (!fees) {
    return (
      <Panel title="SALE FEES" subtitle="What the checklist starts at when you record a sale">
        <PanelSection>
          <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
            {error ?? 'Loading…'}
          </p>
        </PanelSection>
      </Panel>
    )
  }

  const settled = applyFees(EG_GROSS, EG_HEAD, fees)

  return (
    <Panel title="SALE FEES" subtitle="What the checklist starts at when you record a sale">
      <PanelSection>
        <ContextBanner tone="info">
          Starting points, not rules. Every one can be ticked off or changed on the sale itself —
          cattle that never left the place owe no hauling.
        </ContextBanner>
      </PanelSection>

      {fees.map(f => (
        <PanelSection key={f.key}>
          <Toggle
            label={f.label}
            description={HINT.get(f.key)}
            checked={f.on}
            onChange={v => set(f.key, { on: v })}
            disabled={!canEdit}
          />
          <div className="flex items-start gap-3 pt-2.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={f.rate}
                  onChange={e => set(f.key, { rate: Number(e.target.value) || 0 })}
                  aria-label={`${f.label} rate`}
                  disabled={!canEdit}
                  className="rounded-[var(--radius-sm)] px-2 py-1 text-sm text-right"
                  style={{ width: 86, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
                <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{unit(f)}</span>

                {/* The tiered one needs both halves, or the minimum means nothing. */}
                {f.basis === 'min_plus_per_head' && (
                  <>
                    <span className="type-helper" style={{ color: 'var(--text-muted)' }}>covers</span>
                    <input
                      type="number" step="1" min="0" value={f.covers ?? 0}
                      onChange={e => set(f.key, { covers: Number(e.target.value) || 0 })}
                      aria-label={`${f.label} head covered by the minimum`}
                      disabled={!canEdit}
                  className="rounded-[var(--radius-sm)] px-2 py-1 text-sm text-right"
                      style={{ width: 58, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    />
                    <span className="type-helper" style={{ color: 'var(--text-muted)' }}>head, then $</span>
                    <input
                      type="number" step="0.01" min="0" value={f.perHeadOver ?? 0}
                      onChange={e => set(f.key, { perHeadOver: Number(e.target.value) || 0 })}
                      aria-label={`${f.label} per head beyond the minimum`}
                      disabled={!canEdit}
                  className="rounded-[var(--radius-sm)] px-2 py-1 text-sm text-right"
                      style={{ width: 70, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    />
                    <span className="type-helper" style={{ color: 'var(--text-muted)' }}>each after</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </PanelSection>
      ))}

      {/* A percentage and a per-head charge do not compare until you see them
          against the same sale. */}
      <PanelSection>
        <p className="type-section-label" style={{ color: 'var(--text-muted)', margin: '0 0 6px' }}>
          ON A {usd(EG_GROSS)} SALE OF {EG_HEAD} HEAD
        </p>
        {settled.fees.length === 0 ? (
          <p className="type-helper" style={{ color: 'var(--text-muted)' }}>Nothing starts ticked.</p>
        ) : (
          settled.fees.map(f => (
            <div key={f.label} className="flex items-baseline justify-between gap-3" style={{ padding: '2px 0' }}>
              <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{f.label}</span>
              <span className="text-sm tabular-nums" style={{ color: 'var(--text)' }}>-{usd(f.amount)}</span>
            </div>
          ))
        )}
        <div className="flex items-baseline justify-between gap-3" style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
          <span className="type-helper" style={{ color: 'var(--text)' }}>Net to the owner</span>
          <span className="tabular-nums" style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>
            {usd(settled.net)}
          </span>
        </div>
      </PanelSection>

      <PanelSection>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="type-helper" style={{ color: error ? 'var(--danger-fg)' : 'var(--text-muted)', margin: 0 }}>
            {error ?? note ?? (configured ? 'Using your figures.' : 'Using the figures the app shipped with.')}
          </p>
          <div className="flex items-center gap-2">
            {canEdit && configured && (
              <Button type="button" intent="ghost" onClick={reset} disabled={saving}>RESET</Button>
            )}
            {canEdit && (
              <Button type="button" intent="primary" onClick={save} loading={saving} disabled={!dirty}>
                SAVE
              </Button>
            )}
          </div>
        </div>
      </PanelSection>
    </Panel>
  )
}
