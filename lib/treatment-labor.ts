// The labour charge for giving a treatment the vet prescribed.
//
// When the vet administers it, her practice bills direct and BrandBook only
// records that it happened. When the RANCH administers her prescription, the
// ranch did the work and charges for it — a flat rate per head, derived from
// an hourly cost by the operator.
//
// That makes administered_by_role a billing switch, not a label, which is why
// it lives here rather than inline in the route: creating the line, moving it
// when the answer changes, and removing it when the treatment is deleted all
// have to agree, and three copies of that would not stay agreeing for long.

import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, 'public', any>

const CATEGORY = 'Treatment Labor'

export interface TreatmentLaborInput {
  healthEventId: string
  animalId: string
  eventDate: string
  drugName: string | null
  administeredByRole: 'vet' | 'ranch' | null
  /** The line already attached to this event, if any. */
  existingExpenseId: string | null
}

export interface TreatmentLaborResult {
  expenseId: string | null
  amount: number | null
  /** Why nothing was charged, when nothing was. */
  skipped: string | null
}

/**
 * Bring the labour line into line with the treatment.
 *
 * Idempotent by design: called on create and on every edit, and it either
 * creates, updates, removes, or leaves the line alone so that re-saving a
 * treatment never bills twice.
 */
export async function syncTreatmentLabor(
  supabase: DB,
  input: TreatmentLaborInput,
): Promise<TreatmentLaborResult> {
  const { existingExpenseId } = input

  const remove = async (why: string): Promise<TreatmentLaborResult> => {
    if (existingExpenseId) {
      // Only ever the line this event raised. A line already swept onto an
      // invoice is left alone -- unbilling something already sent to an owner
      // is a decision for a human, not a side effect of an edit.
      const { data: exp } = await supabase
        .from('lease_expenses')
        .select('id, invoice_id')
        .eq('id', existingExpenseId)
        .maybeSingle()

      const row = exp as { id: string; invoice_id: string | null } | null
      if (row && !row.invoice_id) {
        await supabase.from('lease_expenses').delete().eq('id', row.id)
      } else if (row?.invoice_id) {
        return { expenseId: existingExpenseId, amount: null, skipped: 'already invoiced — left in place' }
      }
    }
    return { expenseId: null, amount: null, skipped: why }
  }

  if (input.administeredByRole !== 'ranch') {
    return remove('the vet administered it, so the practice bills direct')
  }

  const { data: ranch } = await supabase
    .from('ranch_settings')
    .select('treatment_labor_per_head')
    .limit(1)
    .maybeSingle()

  const rate = Number((ranch as { treatment_labor_per_head: number | null } | null)?.treatment_labor_per_head ?? 0)
  if (!Number.isFinite(rate) || rate <= 0) {
    return remove('no treatment labour rate is set')
  }

  // Whose animal it is decides who pays. Ranch-owned stock routes to the
  // is_self owner so the cost still lands in P&L and Schedule F rather than
  // disappearing.
  const [{ data: animal }, { data: selfOwner }, { data: category }] = await Promise.all([
    supabase.from('animals').select('id, tag_number, owner_id').eq('id', input.animalId).maybeSingle(),
    supabase.from('grazing_owners').select('id').eq('is_self', true).maybeSingle(),
    supabase.from('expense_categories').select('id').eq('name', CATEGORY).maybeSingle(),
  ])

  const a = animal as { id: string; tag_number: string; owner_id: string | null } | null
  if (!a) return remove('animal not found')

  const ownerId = a.owner_id ?? (selfOwner as { id: string } | null)?.id ?? null
  const categoryId = (category as { id: string } | null)?.id ?? null

  const d = new Date(input.eventDate + 'T00:00:00')
  const row = {
    category_name:     CATEGORY,
    category_id:       categoryId,
    expense_type:      'animal_specific',
    description:       `Administered ${input.drugName ?? 'treatment'} — #${a.tag_number}`,
    total_amount:      rate,
    expense_date:      input.eventDate,
    owner_id:          ownerId,
    animal_id:         a.id,
    is_lease_specific: false,
    lease_id:          null,
    year:              d.getFullYear() % 100,
    quarter:           Math.ceil((d.getMonth() + 1) / 3),
  }

  if (existingExpenseId) {
    const { data: exp } = await supabase
      .from('lease_expenses')
      .select('id, invoice_id')
      .eq('id', existingExpenseId)
      .maybeSingle()

    const cur = exp as { id: string; invoice_id: string | null } | null
    if (cur?.invoice_id) {
      // Already billed. Changing the amount underneath a sent invoice would
      // silently restate it.
      return { expenseId: cur.id, amount: null, skipped: 'already invoiced — amount left as billed' }
    }
    if (cur) {
      const { error } = await supabase.from('lease_expenses').update(row).eq('id', cur.id)
      if (error) return { expenseId: null, amount: null, skipped: error.message }
      return { expenseId: cur.id, amount: rate, skipped: null }
    }
  }

  const { data: created, error } = await supabase
    .from('lease_expenses')
    .insert(row)
    .select('id')
    .single()

  if (error) return { expenseId: null, amount: null, skipped: error.message }
  return { expenseId: (created as { id: string }).id, amount: rate, skipped: null }
}

/** Remove the labour line when its treatment is deleted. */
export async function removeTreatmentLabor(supabase: DB, expenseId: string | null) {
  if (!expenseId) return
  const { data } = await supabase
    .from('lease_expenses')
    .select('id, invoice_id')
    .eq('id', expenseId)
    .maybeSingle()
  const row = data as { id: string; invoice_id: string | null } | null
  if (row && !row.invoice_id) {
    await supabase.from('lease_expenses').delete().eq('id', row.id)
  }
}
