'use client'

import { applyFees, SALE_FEES, type AppliedFee } from '@/lib/sale-fees'

/**
 * What comes off this sale, ticked one line at a time.
 *
 * The old code took a flat percentage off everything. That is wrong in both
 * directions: cattle sold to a neighbour that never left the place owe no
 * commission and no hauling, and a load that went to the barn owes a brand
 * inspection and a checkoff that a percentage never captured.
 *
 * So it is a checklist. It prices itself as boxes are ticked, against the same
 * arithmetic the email uses afterwards — the operator sees the owner's net
 * before he presses record, which is the only way to notice a wrong fee while
 * it can still be fixed.
 */

const usd = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const HINT = new Map(SALE_FEES.map(f => [f.key, f.hint]))

function rateLabel(f: AppliedFee) {
  switch (f.basis) {
    case 'pct_of_gross':      return '% of gross'
    case 'per_head':          return '$ per head'
    case 'min_plus_per_head': return `$ min (covers ${f.covers ?? 0}, then $${(f.perHeadOver ?? 0).toFixed(2)})`
    default:                  return '$ flat'
  }
}

export function SaleFeeChecklist({ gross, head, fees, onChange }: {
  gross: number
  head: number
  fees: AppliedFee[]
  onChange: (next: AppliedFee[]) => void
}) {
  const settled = applyFees(gross, head, fees)
  const priced = new Map(settled.fees.map(f => [f.label, f.amount]))

  const set = (key: string, patch: Partial<AppliedFee>) =>
    onChange(fees.map(f => (f.key === key ? { ...f, ...patch } : f)))

  return (
    <div
      className="rounded-[var(--radius-md)] overflow-hidden"
      style={{ border: '1px solid var(--border)', background: 'var(--surface-2)' }}
    >
      <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <p className="type-section-label" style={{ color: 'var(--text-muted)', margin: 0 }}>
          FEES ON THIS SALE
        </p>
        <p className="type-helper" style={{ color: 'var(--text-muted)', margin: '2px 0 0' }}>
          Tick what applies. Nothing is assumed.
        </p>
      </div>

      <div className="flex flex-col">
        {fees.map(f => {
          // Priced by label because that is what the settlement returns, and a
          // zero-rate fee is dropped there rather than printed as -$0.00.
          const amount = [...priced.entries()].find(([l]) => l.startsWith(f.label))?.[1] ?? 0
          return (
            <div
              key={f.key}
              className="flex items-start gap-3 px-3 py-2.5"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              <input
                id={`fee-${f.key}`}
                type="checkbox"
                checked={f.on}
                onChange={e => set(f.key, { on: e.target.checked })}
                className="mt-0.5 flex-shrink-0"
                style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
              />

              <label htmlFor={`fee-${f.key}`} className="flex-1 min-w-0 cursor-pointer">
                <span className="block text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  {f.label}
                </span>
                <span className="block type-helper" style={{ color: 'var(--text-muted)' }}>
                  {HINT.get(f.key)}
                </span>
              </label>

              <div className="flex items-center gap-2 flex-shrink-0">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={f.rate}
                  disabled={!f.on}
                  onChange={e => set(f.key, { rate: Number(e.target.value) || 0 })}
                  aria-label={`${f.label} rate — ${rateLabel(f)}`}
                  title={rateLabel(f)}
                  className="rounded-[var(--radius-sm)] px-2 py-1 text-sm text-right"
                  style={{
                    width: 74,
                    background: 'var(--surface-3)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    opacity: f.on ? 1 : 0.45,
                  }}
                />
                <span
                  className="text-sm tabular-nums text-right"
                  style={{ width: 78, color: f.on && amount ? 'var(--text)' : 'var(--text-disabled)' }}
                >
                  {f.on && amount ? `-${usd(amount)}` : '—'}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* What the owner actually gets. The reason the checklist exists. */}
      <div className="px-3 py-3" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-1)' }}>
        <Line label="Gross" value={usd(gross)} />
        <Line label={`Fees (${settled.fees.length})`} value={settled.feeTotal ? `-${usd(settled.feeTotal)}` : usd(0)} />
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
          <Line label="Net to the owner" value={usd(settled.net)} strong />
        </div>
      </div>
    </div>
  )
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3" style={{ padding: '2px 0' }}>
      <span className="type-helper" style={{ color: strong ? 'var(--text)' : 'var(--text-muted)' }}>{label}</span>
      <span
        className="tabular-nums"
        style={{
          fontSize: strong ? 16 : 13,
          fontWeight: strong ? 700 : 600,
          color: strong ? 'var(--accent)' : 'var(--text)',
        }}
      >
        {value}
      </span>
    </div>
  )
}
