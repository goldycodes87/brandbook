import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Where a proposal becomes a record.
 *
 * Shared by the tap-to-confirm route and the voice confirm tool so there is
 * exactly one implementation of "actually write it". Two would drift, and the
 * one that drifted would be the one that skipped a check.
 *
 * Nothing here trusts its input. A payload arrives either from a browser or
 * from a model that heard it over a phone, and both are worth exactly the same
 * amount of trust: none.
 */

export type ExecuteResult =
  | { ok: true; confirmation: string; table: string; rowId: string | null }
  | { ok: false; error: string }

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : null }
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const isUuid = (v: unknown) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

export async function executeProposal(opts: {
  action: string
  payload: Record<string, unknown>
  channel: 'text' | 'voice'
  conversationId: string | null
  authUserId: string
  /** Falls back onto administered_by when the rancher did not name somebody. */
  actorName: string
}): Promise<ExecuteResult> {
  const supabase = createAdminClient()
  const { action, payload } = opts

  let result: ExecuteResult
  let summary = ''

  if (action === 'create_reminder') {
    const title = str(payload.title)
    const due   = payload.due_date
    if (!title)       return { ok: false, error: 'A reminder needs something to remind you of' }
    if (!isDate(due)) return { ok: false, error: 'A reminder needs a real date' }
    if (payload.animal_id != null && !isUuid(payload.animal_id)) {
      return { ok: false, error: 'That animal reference is not valid' }
    }

    const { data, error } = await supabase.from('reminders').insert({
      title,
      due_date: due as string,
      animal_id: (payload.animal_id as string) ?? null,
      notes: str(payload.notes),
      reminder_type: 'manual',
      is_dismissed: false,
    }).select('id').single()

    if (error) return { ok: false, error: error.message }
    summary = `Reminder: ${title} on ${due}`
    result = { ok: true, confirmation: `Set. You'll see it on ${due}.`, table: 'reminders', rowId: (data as { id: string }).id }

  } else if (action === 'create_expense') {
    const description = str(payload.description)
    const amount = num(payload.total_amount)
    const date   = payload.expense_date

    if (!description) return { ok: false, error: 'An expense needs a description' }
    if (amount === null || amount <= 0) return { ok: false, error: 'An expense needs an amount over zero' }
    if (!isDate(date)) return { ok: false, error: 'An expense needs a real date' }
    if (payload.category_id != null && !isUuid(payload.category_id)) {
      return { ok: false, error: 'That category is not valid' }
    }
    if (payload.animal_id != null && !isUuid(payload.animal_id)) {
      return { ok: false, error: 'That animal reference is not valid' }
    }

    const { data, error } = await supabase.from('lease_expenses').insert({
      description,
      total_amount: amount,
      expense_date: date as string,
      category_id:   (payload.category_id as string) ?? null,
      category_name: str(payload.category_name) ?? 'Uncategorised',
      vendor:        str(payload.vendor),
      animal_id:     (payload.animal_id as string) ?? null,
      expense_type: payload.animal_id ? 'animal' : 'herd',
    }).select('id').single()

    if (error) return { ok: false, error: error.message }
    summary = `${description} — $${amount.toFixed(2)} on ${date}`
    result = {
      ok: true,
      confirmation: `Recorded — $${amount.toFixed(2)} on ${date}.` +
        (payload.animal_id ? '' : ' It will be split across owners when the quarter is billed.'),
      table: 'lease_expenses',
      rowId: (data as { id: string }).id,
    }

  } else if (action === 'create_treatment') {
    const animalId = payload.animal_id
    const drug     = str(payload.drug_name)
    const date     = payload.event_date

    if (!isUuid(animalId)) return { ok: false, error: 'That animal reference is not valid' }
    if (!drug)             return { ok: false, error: 'A treatment needs a product' }
    if (!isDate(date))     return { ok: false, error: 'A treatment needs a real date' }

    // Re-derived from the library rather than trusted from the payload. This
    // number decides whether an animal can be sold, and it is the one nobody
    // should be able to talk the app out of — least of all over a phone.
    const { data: drugRow } = await supabase
      .from('drug_library')
      .select('brand_name, withdrawal_days_meat')
      .ilike('brand_name', drug)
      .eq('is_active', true)
      .maybeSingle()

    const found = drugRow as { brand_name: string; withdrawal_days_meat: number | null } | null
    if (!found) return { ok: false, error: `"${drug}" is not in the drug library any more.` }

    const meatDays = found.withdrawal_days_meat ?? 0
    const clear = new Date(`${date}T00:00:00Z`)
    clear.setUTCDate(clear.getUTCDate() + meatDays)
    const clearDate = clear.toISOString().slice(0, 10)

    const { data, error } = await supabase.from('health_events').insert({
      animal_id: animalId as string,
      event_type: 'treatment',
      event_date: date as string,
      drug_name: found.brand_name,
      dose_amount: num(payload.dose_amount),
      dose_unit: str(payload.dose_unit),
      withdrawal_days: meatDays,
      withdrawal_clear_date: clearDate,
      administered_by: str(payload.administered_by) ?? opts.actorName,
      notes: str(payload.notes),
    }).select('id').single()

    if (error) return { ok: false, error: error.message }
    summary = `${found.brand_name} on ${date}${meatDays ? `, clear ${clearDate}` : ''}`
    result = {
      ok: true,
      confirmation: meatDays > 0
        ? `Recorded. ${meatDays} day meat withdrawal — clear on ${clearDate}.`
        : 'Recorded. No meat withdrawal on that one.',
      table: 'health_events',
      rowId: (data as { id: string }).id,
    }

  } else {
    return { ok: false, error: 'I do not know how to do that' }
  }

  // Logged whether it came from a tap or a spoken yes, because those are not
  // equally strong confirmations and a wrong record has to be findable.
  await supabase.from('ai_writes').insert({
    conversation_id: opts.conversationId,
    auth_user_id: opts.authUserId,
    action,
    summary,
    channel: opts.channel,
    table_name: result.ok ? result.table : null,
    row_id: result.ok ? result.rowId : null,
  })

  return result
}
