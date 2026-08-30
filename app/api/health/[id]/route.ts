export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncTreatmentLabor, removeTreatmentLabor } from '@/lib/treatment-labor'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('health_events')
    .select('*, animal:animal_id ( id, tag_number, name )')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()
  const body = await req.json()

  // withdrawal_clear_date is computed by the database from withdrawal_days;
  // accepting it from a client would let the two disagree.
  // labor_expense_id is ours — a client must not be able to point a treatment
  // at somebody else's expense row.
  const { withdrawal_clear_date: _wcd, labor_expense_id: _lei, ...rest } = body

  const { data, error } = await supabase
    .from('health_events')
    .update(rest)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const event = data as {
    id: string; animal_id: string; event_date: string
    drug_name: string | null; administered_by_role: 'vet' | 'ranch' | null
    labor_expense_id: string | null
  }

  // Editing who gave it moves the money: switching ranch → vet withdraws the
  // labour line, and vet → ranch raises one.
  const labor = await syncTreatmentLabor(supabase, {
    healthEventId:      event.id,
    animalId:           event.animal_id,
    eventDate:          event.event_date,
    drugName:           event.drug_name,
    administeredByRole: event.administered_by_role,
    existingExpenseId:  event.labor_expense_id,
  })

  if (labor.expenseId !== event.labor_expense_id) {
    await supabase.from('health_events')
      .update({ labor_expense_id: labor.expenseId })
      .eq('id', id)
  }

  return NextResponse.json({ ...data, labor_expense_id: labor.expenseId, labor })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  // Read the labour line before the row goes: health_events.labor_expense_id
  // is the only pointer to it, and deleting the treatment first would strand
  // the expense on the owner's bill with nothing explaining it.
  const { data } = await supabase
    .from('health_events').select('labor_expense_id').eq('id', id).maybeSingle()
  const laborId = (data as { labor_expense_id: string | null } | null)?.labor_expense_id ?? null

  const { error } = await supabase.from('health_events').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await removeTreatmentLabor(supabase, laborId)
  return new NextResponse(null, { status: 204 })
}
