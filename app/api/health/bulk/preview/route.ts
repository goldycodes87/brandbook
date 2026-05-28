export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { group_type, group_value } = body

  const supabase = createAdminClient()

  let count = 0
  let label = group_type

  switch (group_type) {
    case 'whole_herd': {
      const { count: c } = await supabase.from('animals').select('id', { count: 'exact', head: true }).eq('status', 'active')
      count = c ?? 0
      label = 'Whole Herd'
      break
    }
    case 'cows_only': {
      const { count: c } = await supabase.from('animals').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('sex', 'cow')
      count = c ?? 0
      label = 'Cows'
      break
    }
    case 'bulls_only': {
      const { count: c } = await supabase.from('animals').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('sex', 'bull')
      count = c ?? 0
      label = 'Bulls'
      break
    }
    case 'heifers_only': {
      const { count: c } = await supabase.from('animals').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('sex', 'heifer')
      count = c ?? 0
      label = 'Heifers'
      break
    }
    case 'steers_only': {
      const { count: c } = await supabase.from('animals').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('sex', 'steer')
      count = c ?? 0
      label = 'Steers'
      break
    }
    case 'calves_only': {
      const { count: c } = await supabase.from('animals').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('sex', 'calf')
      count = c ?? 0
      label = 'Calves'
      break
    }
    case 'by_ear_tag_color': {
      if (!group_value) return NextResponse.json({ error: 'group_value required' }, { status: 400 })
      const { count: c } = await supabase.from('animals').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('ear_tag_color', group_value)
      count = c ?? 0
      label = `${group_value} ear tags`
      break
    }
    default:
      count = 0
      label = group_type
  }

  return NextResponse.json({ count, label })
}
