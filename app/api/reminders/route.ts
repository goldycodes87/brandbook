export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const sp       = req.nextUrl.searchParams
  const upcoming = sp.get('upcoming')
  const days     = Number(sp.get('days') ?? 30)
  const supabase = createAdminClient()

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('reminders')
    .select(`*, animal:animal_id ( id, tag_number, ear_tag_color, name )`)
    .order('due_date', { ascending: true })

  if (upcoming === 'true') {
    query = query.eq('is_dismissed', false).lte('due_date', cutoffStr)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { animal_id, reminder_type, due_date, title, notes, protocol_group_id } = body
  if (!due_date) return NextResponse.json({ error: 'due_date required' }, { status: 400 })
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('reminders')
    .insert({
      animal_id:         animal_id  || null,
      reminder_type:     reminder_type || null,
      due_date,
      title:             title || null,
      notes:             notes || null,
      protocol_group_id: protocol_group_id || null,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, is_dismissed } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const supabase = createAdminClient()
  const update: Record<string, unknown> = {}
  if (is_dismissed !== undefined) {
    update.is_dismissed = Boolean(is_dismissed)
    update.dismissed_at = is_dismissed ? new Date().toISOString() : null
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('reminders')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
