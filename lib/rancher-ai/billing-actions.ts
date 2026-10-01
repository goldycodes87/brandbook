import { createAdminClient } from '@/lib/supabase/admin'
import type { WriteAction, ActionContext } from '@/lib/rancher-ai/write-actions'

/**
 * Taking an invoice back.
 *
 * The drafting action lives with the rest in write-actions.ts; these two are
 * here because they are the only things the assistant does that destroy
 * something, and they are worth being able to read in one sitting.
 *
 * Neither of them sends. Nothing in the assistant sends — an invoice reaching
 * an owner is a decision with a person on the other end, and the billing
 * system was rebuilt around not being able to charge anyone twice. A draft you
 * review is help; a bill sent because a model misheard a quarter is the
 * argument this app exists to prevent.
 */

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const isUuid = (v: unknown) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const money = (n: number) => `$${n.toFixed(2)}`
const S = (description: string) => ({ type: 'string', description })

const db = (ctx: ActionContext) => createAdminClient(ctx.actorName)

interface InvoiceRow {
  id: string
  invoice_number: string | null
  status: string | null
  total_amount: number | null
  owner_id: string
}

/**
 * One invoice, from what the rancher called it.
 *
 * By number, because that is what is written on the thing he is looking at.
 * An ambiguous reference comes back as the candidates rather than a guess:
 * both actions below are hard to take back.
 */
async function resolveInvoice(ref: string): Promise<
  { ok: true; row: InvoiceRow } | { ok: false; error: string }
> {
  const needle = ref.replace(/[^0-9a-z]/gi, '')
  if (!needle) return { ok: false, error: 'Which invoice? Give me the number.' }

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, total_amount, owner_id')
    .order('created_at', { ascending: false })
    .limit(200)

  const rows = (data ?? []) as InvoiceRow[]
  const hits = rows.filter(r => (r.invoice_number ?? '').replace(/[^0-9a-z]/gi, '').includes(needle))

  if (hits.length === 0) return { ok: false, error: `No invoice matching "${ref}".` }
  if (hits.length > 1) {
    return { ok: false, error: `"${ref}" matches ${hits.map(h => h.invoice_number).join(', ')}. Which one?` }
  }
  return { ok: true, row: hits[0] }
}

async function ownerNameFor(ownerId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('grazing_owners').select('name, owner_name, company_name').eq('id', ownerId).maybeSingle()
  const o = data as { name: string | null; owner_name: string | null; company_name: string | null } | null
  return o?.company_name || o?.owner_name || o?.name || 'that owner'
}

/**
 * Void an invoice.
 *
 * How a sent invoice is retracted. The number, the figures and the reason stay
 * on the books, it leaves the owner's portal, and the expenses it covered are
 * free to be billed again.
 */
export const voidInvoice: WriteAction = {
  name: 'void_invoice',
  tier: 'billing_draft',
  description:
    'Void an invoice by its number. It stays on the books marked void, leaves the owner portal, ' +
    'and frees its expenses to be billed again. Use for "void 2604002". A paid invoice cannot be voided.',
  input: {
    invoice: S('Invoice number, e.g. 2604002.'),
    reason:  S('Why it is being voided. Optional, and kept on the record.'),
  },
  required: ['invoice'],

  async prepare(input) {
    const ref = str(input.invoice)
    if (!ref) return { error: 'Which invoice?' }

    const found = await resolveInvoice(ref)
    if (!found.ok) return { error: found.error }
    const inv = found.row

    if (inv.status === 'void') return { error: `${inv.invoice_number} is already void.` }
    if (inv.status === 'paid') {
      return { error: `${inv.invoice_number} is paid. That stays as it is — it is a record of money received.` }
    }

    const who  = await ownerNameFor(inv.owner_id)
    const sent = inv.status === 'sent' ? ' It has already been sent to them.' : ''

    return {
      summary:
        `Void ${inv.invoice_number} — ${who}, ${money(Number(inv.total_amount ?? 0))}.${sent} ` +
        `It stays on the books marked void and its expenses go back to unbilled.`,
      payload: { id: inv.id, invoice_number: inv.invoice_number, reason: str(input.reason) },
    }
  },

  async execute(payload, ctx) {
    if (!isUuid(payload.id)) return { error: 'That invoice reference is not valid' }
    const id = payload.id as string
    const supabase = db(ctx)

    const { data: cur } = await supabase.from('invoices').select('notes').eq('id', id).maybeSingle()
    const prior = (cur as { notes: string | null } | null)?.notes ?? ''
    const stamp = `Voided ${new Date().toISOString().slice(0, 10)}${payload.reason ? ` — ${payload.reason}` : ''}`

    const { error } = await supabase
      .from('invoices')
      .update({ status: 'void', notes: prior ? `${prior} — ${stamp}` : stamp })
      .eq('id', id)

    if (error) return { error: error.message }
    return {
      confirmation: `${payload.invoice_number} is void. Its expenses are free to be billed again.`,
      table: 'invoices',
      rowId: id,
    }
  },
}

/**
 * Delete a draft or a voided invoice.
 *
 * Only those two. A sent, approved or paid invoice is a record of money put in
 * front of somebody, and removing one leaves a hole in the sequence nobody can
 * explain a year later. Void is the tool for that.
 */
export const deleteInvoice: WriteAction = {
  name: 'delete_invoice',
  tier: 'billing_draft',
  description:
    'Delete a DRAFT or VOIDED invoice by its number, for good. Its expenses go back to unbilled. ' +
    'Use for "delete 2604002". A sent or paid invoice cannot be deleted — void it instead.',
  input: { invoice: S('Invoice number, e.g. 2604002.') },
  required: ['invoice'],

  async prepare(input) {
    const ref = str(input.invoice)
    if (!ref) return { error: 'Which invoice?' }

    const found = await resolveInvoice(ref)
    if (!found.ok) return { error: found.error }
    const inv = found.row

    if (inv.status !== 'draft' && inv.status !== 'void') {
      return {
        error:
          `${inv.invoice_number} is ${inv.status}. I can only delete a draft or a voided invoice — ` +
          `void it first if it needs taking back.`,
      }
    }

    const who = await ownerNameFor(inv.owner_id)
    return {
      summary:
        `Delete ${inv.invoice_number} (${inv.status}) — ${who}, ${money(Number(inv.total_amount ?? 0))}. ` +
        `It goes for good and cannot be brought back. Its expenses return to unbilled.`,
      payload: { id: inv.id, invoice_number: inv.invoice_number },
    }
  },

  async execute(payload, ctx) {
    if (!isUuid(payload.id)) return { error: 'That invoice reference is not valid' }
    const id = payload.id as string
    const supabase = db(ctx)

    // Hand back what it was holding, first. An expense left stamped on a row
    // that no longer exists can never be charged to anybody again — that was
    // the live bug in the old delete route.
    const { error: unstamp } = await supabase
      .from('lease_expenses').update({ invoice_id: null }).eq('invoice_id', id)
    if (unstamp) return { error: unstamp.message }

    const { error: unalloc } = await supabase
      .from('expense_allocations').delete().eq('invoice_id', id)
    if (unalloc) return { error: unalloc.message }

    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) return { error: error.message }

    return {
      confirmation: `${payload.invoice_number} is gone. Its expenses are back to unbilled.`,
      table: 'invoices',
      rowId: null,
    }
  },
}
