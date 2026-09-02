import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Receipts that have arrived and not been looked at.
 *
 * Renders nothing when there are none — a dashboard row that permanently says
 * "0 waiting" is a row people stop seeing, which is the opposite of the point.
 *
 * This exists because the review queue was reachable only from a ghost button
 * on the Billing page. A receipt forwarded from a feed store on Monday has to
 * come and find you on Wednesday; waiting to be found is how a shoebox of
 * paper works, and the shoebox is what this replaces.
 */
export async function ReceiptsWaiting() {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('inbound_receipts')
    .select('vendor, receipt_total')
    .is('reviewed_at', null)
    .eq('parse_status', 'parsed')
    .order('created_at', { ascending: false })
    .limit(4)

  const rows = (data ?? []) as Array<{ vendor: string | null; receipt_total: number | null }>
  if (rows.length === 0) return null

  const total = rows.reduce((s, r) => s + (Number(r.receipt_total) || 0), 0)
  const names = [...new Set(rows.map(r => r.vendor).filter(Boolean))].slice(0, 2)

  return (
    /* Spacing is the dashboard's attention stack to decide, not this card's —
       it sits in a gap-ed column beside MessagesCard. */
    <Link
      href="/expenses/review"
      className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)]"
      style={{
        border: '1px solid var(--accent-border)',
        background: 'var(--accent-soft)',
        boxShadow: 'var(--lift)',
      }}
    >
      <span style={{ fontSize: 18 }} aria-hidden>🧾</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {rows.length} receipt{rows.length === 1 ? '' : 's'} waiting on you
        </span>
        <span className="block type-helper truncate" style={{ color: 'var(--text-muted)' }}>
          {names.length ? names.join(', ') : 'Forwarded in'}
          {total > 0 && ` · $${total.toFixed(2)}`}
        </span>
      </span>
      <span style={{ color: 'var(--accent)' }}>→</span>
    </Link>
  )
}
