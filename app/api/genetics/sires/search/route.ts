export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const q        = req.nextUrl.searchParams.get('q') ?? ''
  const supabase = createAdminClient()

  if (!q.trim()) return NextResponse.json([])

  const { data, error } = await (supabase as any)
    .from('sire_library')
    .select('id, bull_name, breed, naab_code, stud, bull_type, epd_dollar_b, epd_bw, epd_ww')
    .eq('is_active', true)
    .or(`bull_name.ilike.%${q}%,naab_code.ilike.%${q}%,stud.ilike.%${q}%`)
    .order('bull_name')
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
