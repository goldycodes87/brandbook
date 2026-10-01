import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Who wants to hear about what.
 *
 * One place decides whether an email may go out, because the alternative is
 * every caller remembering to check — and the one that forgets is the one that
 * emails a man who asked to be left alone.
 *
 * contact_email is the master switch. The per-event flags narrow it, so an
 * owner who wants his invoices but not a note every time a calf is weighed can
 * have exactly that. Off at the top means nothing goes, whatever the flags say.
 */

export type NotifyEvent = 'purchases' | 'sales' | 'invoices' | 'herd_updates'

const COLUMN: Record<NotifyEvent, string> = {
  purchases:    'notify_purchases',
  sales:        'notify_sales',
  invoices:     'notify_invoices',
  herd_updates: 'notify_herd_updates',
}

export interface Recipient {
  personId: string
  email: string
  name: string
}

/**
 * Everyone attached to this owner who wants this kind of email.
 *
 * An owner can have more than one person on the account — a spouse, a ranch
 * manager, a partner in the LLC — and each sets their own preferences. Returns
 * only those with an address and both switches on.
 */
export async function recipientsFor(ownerId: string, event: NotifyEvent): Promise<Recipient[]> {
  const supabase = createAdminClient()

  const { data: memberships } = await supabase
    .from('portal_memberships')
    .select('person_id')
    .eq('owner_id', ownerId)

  const personIds = [...new Set(
    (memberships ?? [])
      .map((m: { person_id: string | null }) => m.person_id)
      .filter((x): x is string => Boolean(x)),
  )]
  if (personIds.length === 0) return []

  const { data: people } = await supabase
    .from('portal_people')
    .select(`id, email, first_name, preferred_name, contact_email, ${COLUMN[event]}`)
    .in('id', personIds)
    .eq('contact_email', true)
    .eq(COLUMN[event], true)

  type Row = {
    id: string; email: string | null
    first_name: string | null; preferred_name: string | null
  }

  return ((people ?? []) as unknown as Row[])
    .filter(p => (p.email ?? '').trim().length > 0)
    .map(p => ({
      personId: p.id,
      email: (p.email as string).trim(),
      // The greeting name, not the entity. Greeting a man by his LLC is the
      // tell that nobody read what he typed.
      name: (p.preferred_name || p.first_name || '').trim(),
    }))
}

/** The shape the portal and the operator screen both read and write. */
export interface NotifySettings {
  contact_email: boolean
  contact_text: boolean
  notify_purchases: boolean
  notify_sales: boolean
  notify_invoices: boolean
  notify_herd_updates: boolean
}

export const NOTIFY_FIELDS = [
  'contact_email', 'contact_text',
  'notify_purchases', 'notify_sales', 'notify_invoices', 'notify_herd_updates',
] as const

/**
 * What each switch means, in the owner's words rather than the column's.
 *
 * Kept beside the columns so a new event cannot be added to the database and
 * then quietly show up in the portal as a checkbox nobody can explain.
 */
export const NOTIFY_COPY: Array<{ key: keyof NotifySettings; title: string; detail: string }> = [
  { key: 'notify_invoices',     title: 'Invoices',        detail: 'When a bill is sent to you, and when a payment is recorded.' },
  { key: 'notify_purchases',    title: 'Cattle you buy',  detail: 'What you bought, what each head cost, and who you bought from.' },
  { key: 'notify_sales',        title: 'Cattle you sell', detail: 'What sold, the gross, every fee, and what you cleared.' },
  { key: 'notify_herd_updates', title: 'Herd activity',   detail: 'Weights, health treatments and calving. Off by default — it is all in your portal.' },
]
