export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminSession } from '@/lib/admin-auth'

/**
 * The only place RancherAI's writes actually happen.
 *
 * The propose_ tools build a payload and hand it back; nothing is saved until
 * a person taps yes and it arrives here. That means this route cannot trust
 * the payload either — it came back through a browser, so every field is
 * re-validated and re-coerced exactly as if it had been typed into a form.
 *
 * Deliberately narrow: three actions, each writing one row. Anything that
 * needs to write several rows atomically — a split expense, a batch treatment —
 * belongs behind the existing endpoint for it, not here.
 */

type Payload = Record<string, unknown>

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : null }
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const isUuid = (v: unknown) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const action  = typeof body.action === 'string' ? body.action : ''
  const payload = (body.payload ?? {}) as Payload

  const supabase = createAdminClient()

  // ── A reminder ──────────────────────────────────────────────────────────────
  if (action === 'create_reminder') {
    const title = str(payload.title)
    const due   = payload.due_date
    if (!title)        return NextResponse.json({ error: 'A reminder needs something to remind you of' }, { status: 400 })
    if (!isDate(due))  return NextResponse.json({ error: 'A reminder needs a real date' }, { status: 400 })
    if (payload.animal_id != null && !isUuid(payload.animal_id)) {
      return NextResponse.json({ error: 'That animal reference is not valid' }, { status: 400 })
    }

    const { error } = await supabase.from('reminders').insert({
      title,
      due_date: due as string,
      animal_id: (payload.animal_id as string) ?? null,
      notes: str(payload.notes),
      reminder_type: 'manual',
      is_dismissed: false,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, confirmation: `Set. You'll see it on ${due}.` })
  }

  // ── An expense ──────────────────────────────────────────────────────────────
  if (action === 'create_expense') {
    const description = str(payload.description)
    const amount = num(payload.total_amount)
    const date   = payload.expense_date

    if (!description)            return NextResponse.json({ error: 'An expense needs a description' }, { status: 400 })
    if (amount === null || amount <= 0) return NextResponse.json({ error: 'An expense needs an amount over zero' }, { status: 400 })
    if (!isDate(date))           return NextResponse.json({ error: 'An expense needs a real date' }, { status: 400 })
    if (payload.category_id != null && !isUuid(payload.category_id)) {
      return NextResponse.json({ error: 'That category is not valid' }, { status: 400 })
    }
    if (payload.animal_id != null && !isUuid(payload.animal_id)) {
      return NextResponse.json({ error: 'That animal reference is not valid' }, { status: 400 })
    }

    const { error } = await supabase.from('lease_expenses').insert({
      description,
      total_amount: amount,
      expense_date: date as string,
      category_id:   (payload.category_id as string) ?? null,
      category_name: str(payload.category_name),
      vendor:        str(payload.vendor),
      animal_id:     (payload.animal_id as string) ?? null,
      // Left for the allocation pass to work out, exactly as a hand-entered
      // expense is. Nothing about arriving via RancherAI makes it special.
      expense_type: payload.animal_id ? 'animal' : 'herd',
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      ok: true,
      confirmation: `Recorded — $${amount.toFixed(2)} on ${date}.` +
        (payload.animal_id ? '' : ' It will be split across owners when the quarter is billed.'),
    })
  }

  // ── A treatment ─────────────────────────────────────────────────────────────
  if (action === 'create_treatment') {
    const animalId = payload.animal_id
    const drug     = str(payload.drug_name)
    const date     = payload.event_date

    if (!isUuid(animalId)) return NextResponse.json({ error: 'That animal reference is not valid' }, { status: 400 })
    if (!drug)             return NextResponse.json({ error: 'A treatment needs a product' }, { status: 400 })
    if (!isDate(date))     return NextResponse.json({ error: 'A treatment needs a real date' }, { status: 400 })

    // The withdrawal is re-derived from the library rather than trusted from
    // the payload. It decides whether an animal can be sold, and it is the one
    // number nobody should be able to talk the app out of.
    const { data: drugRow } = await supabase
      .from('drug_library')
      .select('brand_name, withdrawal_days_meat')
      .ilike('brand_name', drug)
      .eq('is_active', true)
      .maybeSingle()

    const found = drugRow as { brand_name: string; withdrawal_days_meat: number | null } | null
    if (!found) {
      return NextResponse.json({ error: `"${drug}" is not in the drug library any more.` }, { status: 400 })
    }

    const meatDays = found.withdrawal_days_meat ?? 0
    const clear = new Date(`${date}T00:00:00Z`)
    clear.setUTCDate(clear.getUTCDate() + meatDays)
    const clearDate = clear.toISOString().slice(0, 10)

    const { error } = await supabase.from('health_events').insert({
      animal_id: animalId as string,
      event_type: 'treatment',
      event_date: date as string,
      drug_name: found.brand_name,
      dose_amount: num(payload.dose_amount),
      dose_unit: str(payload.dose_unit),
      withdrawal_days: meatDays,
      withdrawal_clear_date: clearDate,
      administered_by: str(payload.administered_by) ?? session.name,
      notes: str(payload.notes),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      ok: true,
      confirmation: meatDays > 0
        ? `Recorded. ${meatDays} day meat withdrawal — clear on ${clearDate}.`
        : 'Recorded. No meat withdrawal on that one.',
    })
  }

  return NextResponse.json({ error: 'I do not know how to do that' }, { status: 400 })
}
