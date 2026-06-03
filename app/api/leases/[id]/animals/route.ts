export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const today = new Date().toISOString().slice(0, 10)

  // Animals currently assigned to this lease
  const { data: assignments, error: assignError } = await supabase
    .from('grazing_assignments')
    .select('animal_id')
    .eq('lease_id', id)
    .or(`end_date.is.null,end_date.gte.${today}`)

  if (assignError) return NextResponse.json({ error: assignError.message }, { status: 500 })

  const animalIds = (assignments ?? []).map((a: { animal_id: string }) => a.animal_id)
  if (!animalIds.length) return NextResponse.json({ data: [] })

  const { data, error } = await supabase
    .from('animals')
    .select('id, tag_number, name, ear_tag_color, sex, status')
    .in('id', animalIds)
    .eq('status', 'active')
    .order('tag_number', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}
