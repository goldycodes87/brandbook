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
  const { start_date, end_date, head_count, notes } = body

  if (!start_date || !end_date)
    return NextResponse.json({ error: 'start_date and end_date are required' }, { status: 400 })
  if (new Date(start_date) >= new Date(end_date))
    return NextResponse.json({ error: 'start_date must be before end_date' }, { status: 400 })
  if (!head_count || Number(head_count) <= 0)
    return NextResponse.json({ error: 'head_count must be greater than 0' }, { status: 400 })

  const { data, error } = await supabase
    .from('grazing_periods')
    .insert({ lease_id: id, start_date, end_date, head_count: Number(head_count), notes: notes || null })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
