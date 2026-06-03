export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('grazing_periods')
    .select('*')
    .eq('lease_id', id)
    .order('start_date', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const body = await req.json()
  const { start_date, end_date, notes, animal_ids } = body

  // head_count derived from animal_ids when provided, else explicit
  const derivedCount = Array.isArray(animal_ids) ? animal_ids.length : Number(body.head_count || 0)

  if (!start_date || !end_date)
    return NextResponse.json({ error: 'start_date and end_date are required' }, { status: 400 })
  if (new Date(start_date) >= new Date(end_date))
    return NextResponse.json({ error: 'start_date must be before end_date' }, { status: 400 })
  if (derivedCount <= 0)
    return NextResponse.json({ error: 'At least one animal (or a head count) is required' }, { status: 400 })

  const insertData: Record<string, unknown> = {
    lease_id: id, start_date, end_date,
    head_count: derivedCount,
    notes: notes || null,
  }
  if (Array.isArray(animal_ids)) insertData.animal_ids = animal_ids

  const { data, error } = await supabase
    .from('grazing_periods')
    .insert(insertData)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
