import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Owners waiting on an answer about buying or selling.
 *
 * Same rule as the receipts row: absent when there is nothing, because a line
 * that permanently reads "0 waiting" is a line people stop seeing.
 *
 * It matters more than most, though. A request comes from a person who is
 * now waiting on you and has no way of knowing whether it arrived — until
 * this shipped, the honest answer was that it hadn't.
 */
export async function RequestsWaiting() {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('owner_requests')
    .select('request_type, owner_id')
    .in('request_type', ['buy', 'sell'])
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(20)

  const rows = (data ?? []) as Array<{ request_type: string; owner_id: string }>
  if (rows.length === 0) return null

  const owners = [...new Set(rows.map(r => r.owner_id))]
  const { data: ownerRows } = await supabase
    .from('grazing_owners')
    .select('id, name, owner_name, company_name')
    .in('id', owners)

  const names = (ownerRows ?? [])
    .map(o => o.company_name || o.owner_name || o.name)
    .filter(Boolean)
    .slice(0, 2)

  const buys  = rows.filter(r => r.request_type === 'buy').length
  const sells = rows.length - buys
  const parts = [buys ? `${buys} to buy` : null, sells ? `${sells} to sell` : null].filter(Boolean)

  return (
    <Link
      href="/requests"
      className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)]"
      style={{
        border: '1px solid var(--accent-border)',
        background: 'var(--accent-soft)',
        boxShadow: 'var(--lift)',
      }}
    >
      <span style={{ fontSize: 18 }} aria-hidden>🤝</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {rows.length} owner request{rows.length === 1 ? '' : 's'} waiting on you
        </span>
        <span className="block type-helper truncate" style={{ color: 'var(--text-muted)' }}>
          {parts.join(' · ')}{names.length ? ` · ${names.join(', ')}` : ''}
        </span>
      </span>
      <span style={{ color: 'var(--accent)' }}>→</span>
    </Link>
  )
}
