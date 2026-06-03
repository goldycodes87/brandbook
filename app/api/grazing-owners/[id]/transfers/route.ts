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

  // Update animal owner and FMV
  await supabase
    .from('animals')
    .update({
      owner_id:        to_owner_id     || null,
      fmv_at_transfer: fmv_at_transfer ?? null,
    })
    .eq('id', animal_id)

  return NextResponse.json({ data }, { status: 201 })
}
