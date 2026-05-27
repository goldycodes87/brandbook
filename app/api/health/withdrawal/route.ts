export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('health_events')
    .select(`
      id,
      event_date,
      event_type,
      drug_name,
      withdrawal_days,
      withdrawal_clear_date,
      animal:animal_id ( id, tag_number, name, photos )
    `)
    .not('withdrawal_clear_date', 'is', null)
    .gte('withdrawal_clear_date', today)
    .order('withdrawal_clear_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
