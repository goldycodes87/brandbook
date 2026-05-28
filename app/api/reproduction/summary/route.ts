export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()
  const yearStart = `${new Date().getFullYear()}-01-01`

  const [bredRes, confirmedRes, openRes, calvedRes, lostRes] = await Promise.all([
    supabase.from('reproduction_events').select('id', { count: 'exact', head: true }).eq('event_type', 'bred'),
    supabase.from('reproduction_events').select('id', { count: 'exact', head: true }).eq('event_type', 'bred').eq('preg_check_result', 'confirmed'),
    supabase.from('reproduction_events').select('id', { count: 'exact', head: true }).eq('event_type', 'bred').eq('preg_check_result', 'open'),
    supabase.from('reproduction_events').select('id', { count: 'exact', head: true }).eq('event_type', 'calved').gte('event_date', yearStart),
    supabase.from('reproduction_events').select('id', { count: 'exact', head: true }).eq('event_type', 'lost'),
  ])

  const totalBred    = bredRes.count ?? 0
  const confirmed    = confirmedRes.count ?? 0
  const open         = openRes.count ?? 0
  const calvedYear   = calvedRes.count ?? 0
  const lost         = lostRes.count ?? 0

  const pregRate    = confirmed + open > 0 ? Math.round((confirmed / (confirmed + open)) * 100) : null
  const calvingRate = totalBred > 0 ? Math.round((calvedYear / totalBred) * 100) : null

  return NextResponse.json({
    summary: {
      total_bred:        totalBred,
      confirmed_pregnant: confirmed,
      open_or_recheck:   open,
      calved_this_year:  calvedYear,
      lost,
      pregnancy_rate_pct: pregRate,
      calving_rate_pct:  calvingRate,
    }
  })
}
