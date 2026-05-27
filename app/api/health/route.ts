export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = req.nextUrl

  const animal_id     = searchParams.get('animal_id')
  const event_type    = searchParams.get('event_type')
  const date_from     = searchParams.get('date_from')
  const date_to       = searchParams.get('date_to')
  const in_withdrawal = searchParams.get('in_withdrawal')

  let query = supabase
    .from('health_events')
    .select(`
      *,
      animal:animal_id ( id, tag_number, name )
    `)
    .order('event_date', { ascending: false })

  if (animal_id)   query = query.eq('animal_id', animal_id)
  if (event_type)  query = query.eq('event_type', event_type)
  if (date_from)   query = query.gte('event_date', date_from)
  if (date_to)     query = query.lte('event_date', date_to)
  if (in_withdrawal === 'true') {
    query = query
      .not('withdrawal_clear_date', 'is', null)
      .gte('withdrawal_clear_date', new Date().toISOString().slice(0, 10))
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()

  console.log('[health POST] body:', JSON.stringify(body))

  const { data, error } = await supabase
    .from('health_events')
    .insert({
      animal_id:       body.animal_id,
      event_type:      body.event_type,
      event_date:      body.event_date || new Date().toISOString().split('T')[0],
      drug_name:       body.drug_name       || null,
      dose_amount:     body.dose_amount     || null,
      dose_unit:       body.dose_unit       || null,
      withdrawal_days: body.withdrawal_days || null,
      bcs_score:       body.bcs_score       || null,
      administered_by: body.administered_by || null,
      notes:           body.notes           || null,
    })
    .select()
    .single()

  console.log('[health POST] result:', error?.message || 'success')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
