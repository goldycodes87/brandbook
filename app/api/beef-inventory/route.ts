export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('beef_inventory')
    .select('*, animals!beef_inventory_animal_id_fkey(id, tag_number, name, sex, breeds, ear_tag_color, status)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { animal_id, tag_number, breed_summary, estimated_harvest_weight, cost_basis } = body

  if (!animal_id) return NextResponse.json({ error: 'animal_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('beef_inventory')
    .insert({
      animal_id,
      tag_number:               tag_number || null,
      breed_summary:            breed_summary || null,
      estimated_harvest_weight: estimated_harvest_weight ?? null,
      cost_basis:               cost_basis ?? null,
      status:                   'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update animal: flag for beef production
  await supabase
    .from('animals')
    .update({ beef_production_flagged_at: new Date().toISOString() })
    .eq('id', animal_id)

  return NextResponse.json({ data }, { status: 201 })
}
