export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('reproduction_events')
    .select(`
      id, event_type, event_date, breed_method, conception_method,
      sire_name_text, expected_calving_date, calving_ease_score,
      preg_check_result, preg_check_method, days_bred,
      weaning_date, weaning_weight_lbs, ai_technician, notes, created_at,
      sire:sire_id ( id, tag_number, name ),
      calf:calf_id ( id, tag_number, name, sex, dob )
    `)
    .eq('animal_id', id)
    .order('event_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
