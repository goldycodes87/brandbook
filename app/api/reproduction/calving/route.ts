export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  // Delegates to main reproduction POST with create_calf forced true
  const body = await req.json()

  const forwardRes = await fetch(new URL('/api/reproduction', req.url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, create_calf: true }),
  })

  const data = await forwardRes.json()
  return NextResponse.json(data, { status: forwardRes.status })
}

export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 20), 100)

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('reproduction_events')
    .select(`
      *,
      animal:animal_id ( id, tag_number, name, ear_tag_color, sex, breed ),
      calf:calf_id ( id, tag_number, name, sex, dob, birth_weight_lbs, ear_tag_color )
    `)
    .eq('event_type', 'calved')
    .order('event_date', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
