import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Owner messages waiting — and, when nothing is waiting, a way to start one.
 *
 * Unlike <ReceiptsWaiting> this renders even at zero. A receipt queue at zero
 * is nothing to do; an empty inbox is still the door you walk through to send
 * Andy a note, and there is no other door to it on this screen.
 *
 * Counts owner mail only. The vet half of /api/messages queries columns that
 * do not exist on vet_messages and is quarantined — wiring a dashboard badge
 * to it would put a number on the home screen that is wrong by construction.
 */
export async function MessagesCard() {
  const supabase = createAdminClient()

  const { count } = await supabase
    .from('owner_messages')
    .select('id', { count: 'exact', head: true })
    .eq('direction', 'owner_to_rancher')
    .is('read_at', null)

  const unread = count ?? 0
  const lit    = unread > 0

  return (
    <Link
      href="/messages"
      className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)]"
      style={{
        border: `1px solid ${lit ? 'var(--accent-border)' : 'var(--border)'}`,
        background: lit
          ? 'var(--accent-soft)'
          : 'linear-gradient(180deg, var(--surface-2), var(--surface-1))',
        boxShadow: 'var(--lift)',
      }}
    >
      <span style={{ fontSize: 18 }} aria-hidden>✉️</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {lit
            ? `${unread} message${unread === 1 ? '' : 's'} waiting on you`
            : 'Messages'}
        </span>
        <span className="block type-helper truncate" style={{ color: 'var(--text-muted)' }}>
          {lit ? 'From your owners' : 'Nothing new · tap to send one'}
        </span>
      </span>
      <span style={{ color: lit ? 'var(--accent)' : 'var(--text-disabled)' }}>→</span>
    </Link>
  )
}
