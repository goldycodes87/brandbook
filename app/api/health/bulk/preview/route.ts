export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAnimalIds, type GroupType } from '../route'

const LABELS: Record<string, string> = {
  whole_herd:      'Whole Herd',
  cows_only:       'Cows',
  bulls_only:      'Bulls',
  heifers_only:    'Heifers',
  steers_only:     'Steers',
  calves_only:     'Calves',
  yearlings:       'Yearlings',
  by_ear_tag_color: 'By Ear Tag Color',
  by_lease:        'By Lease',
  by_owner:        'By Owner',
  custom:          'Custom List',
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { group_type, group_value, custom_animal_ids, lease_filter } = body

  if (!group_type) return NextResponse.json({ error: 'group_type required' }, { status: 400 })

  const supabase = createAdminClient()
  const ids = await resolveAnimalIds(
    supabase,
    group_type as GroupType,
    group_value,
    custom_animal_ids,
    lease_filter,
  )

  const label = LABELS[group_type] ?? group_type

  return NextResponse.json({ count: ids.length, label })
}
