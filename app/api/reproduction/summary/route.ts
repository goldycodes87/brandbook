export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()
  const yearStart = `${new Date().getFullYear()}-01-01`

  const [bredRes, confirmedRes, openRes, calvedRes, lostRes] = await Promise.all([
    supabase.from('reproduction_events').select('id', { count: 'exact', head: true }).eq('event_type', 'bred'),
    supabase.from('reproduction_events').select('id', { count: 'exact', head: true }).eq('event_type', 'preg_check').eq('preg_check_result', 'confirmed'),
    supabase.from('reproduction_events').select('id', { count: 'exact', head: true }).eq('event_type', 'preg_check').eq('preg_check_result', 'open'),
    supabase.from('reproduction_events').select('id', { count: 'exact', head: true }).eq('event_type', 'calved').gte('event_date', yearStart),
    // 'lost' is not a repro_event_type — the enum is bred, preg_check, calved,
    // weaned, flushed, embryo_transfer. This query errored and the count read
    // 0, so "lost" on the reproduction summary has always been zero whatever
    // happened in the pasture. A lost pregnancy is recorded as a preg_check
    // that came back open after a confirmed one, so that is what this counts
    // until there is a real event type for it.
    supabase.from('reproduction_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'preg_check')
      .eq('preg_check_result', 'recheck'),
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
