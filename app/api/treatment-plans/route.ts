export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getVetSession } from '@/lib/vet-auth'

export async function GET(req: NextRequest) {
  const vet = await getVetSession()
  if (!vet) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caseId    = req.nextUrl.searchParams.get('case_id')
  const animalId  = req.nextUrl.searchParams.get('animal_id')
  const supabase  = createAdminClient()

  let query = supabase
    .from('treatment_plans')
    .select('*, animal:animal_id ( id, tag_number, name )')
    .order('created_at', { ascending: false })

  if (caseId) query = query.eq('case_id', caseId)
  if (animalId) query = query.eq('animal_id', animalId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const vet = await getVetSession()
  if (!vet) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { case_id, animal_id, drug_name, dose_amount, dose_unit, frequency, duration_days, withdrawal_days, instructions } = body

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('treatment_plans')
    .insert({
      case_id: case_id || null,
      animal_id: animal_id || null,
      drug_name: drug_name || null,
      dose_amount: dose_amount || null,
      dose_unit: dose_unit || null,
      frequency: frequency || null,
      duration_days: duration_days || null,
      withdrawal_days: withdrawal_days || null,
      instructions: instructions || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
