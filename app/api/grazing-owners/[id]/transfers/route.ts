export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('calf_transfers')
    .select(`
      *,
      animal:animal_id ( id, tag_number, name, sex, calf_sex, ear_tag_color )
    `)
    .or(`from_owner_id.eq.${id},to_owner_id.eq.${id}`)
    .order('transfer_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json()
  const supabase = createAdminClient()

  const { animal_id, to_owner_id, transfer_type, fmv_at_transfer, transfer_date, notes, settlement_id } = body

  if (!animal_id) return NextResponse.json({ error: 'animal_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('calf_transfers')
    .insert({
      animal_id,
      from_owner_id:   id,
      to_owner_id:     to_owner_id     || null,
      transfer_type:   transfer_type   || 'calf_share',
      fmv_at_transfer: fmv_at_transfer ?? null,
      transfer_date:   transfer_date   || new Date().toISOString().slice(0, 10),
      notes:           notes           || null,
      settlement_id:   settlement_id   || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const on = (transfer_date as string) || new Date().toISOString().slice(0, 10)

  // Update animal owner and FMV.
  //
  // ORDER MATTERS, and it is not obvious: this must happen BEFORE the new
  // grazing assignment is written. grazing_assignments_stamp_owner fills a
  // null owner_id from the animal, and "sold back to the ranch" is expressed
  // as owner_id null — so with the animal not yet updated, the trigger reads
  // the seller and stamps the buyer's new assignment with the seller's name.
  // Tested: doing it the other way round left two head billed to Andy in Q4.
  await supabase
    .from('animals')
    .update({
      owner_id:        to_owner_id     || null,
      fmv_at_transfer: fmv_at_transfer ?? null,
    })
    .eq('id', animal_id)

  // ── Close the seller's grazing, open the buyer's ────────────────────────────
  //
  // Without this the animal keeps one unbroken assignment and the whole of it
  // reads as the new owner's, so a finished quarter the seller already paid
  // for silently moves onto the buyer's next bill. The seller's row ends on
  // the transfer date and the buyer's begins the day after, which puts the
  // boundary exactly where the money changes hands and leaves neither quarter
  // counted twice.
  const { data: openRows } = await supabase
    .from('grazing_assignments')
    .select('id, lease_id, start_date')
    .eq('animal_id', animal_id)
    .is('end_date', null)

  const open = (openRows ?? []) as Array<{ id: string; lease_id: string | null; start_date: string }>
  const dayAfter = new Date(`${on}T00:00:00Z`)
  dayAfter.setUTCDate(dayAfter.getUTCDate() + 1)
  const nextDay = dayAfter.toISOString().slice(0, 10)

  let reopened = 0
  for (const row of open) {
    // An assignment that had not started yet belongs wholly to the buyer;
    // moving its owner is right and splitting it would leave a zero-day row.
    if (row.start_date > on) {
      await supabase.from('grazing_assignments')
        .update({ owner_id: to_owner_id || null }).eq('id', row.id)
      continue
    }

    await supabase.from('grazing_assignments')
      .update({ end_date: on, removal_reason: 'ownership transfer' })
      .eq('id', row.id)

    // A lease is required on an assignment; an open row without one is not
    // something this should invent a replacement for.
    if (!row.lease_id) continue

    const { error: reErr } = await supabase.from('grazing_assignments').insert({
      animal_id,
      lease_id:   row.lease_id,
      start_date: nextDay,
      end_date:   null,
      owner_id:   to_owner_id || null,
      notes:      `Opened on transfer from ${id}`,
    })
    if (!reErr) reopened++
  }

  return NextResponse.json(
    { data, grazing: { closed: open.length, reopened, effective: on } },
    { status: 201 },
  )
}
