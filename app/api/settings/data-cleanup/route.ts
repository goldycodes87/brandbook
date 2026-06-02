export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('animals')
    .select('id, tag_number, name, sex, calf_sex, dob, status')
    .not('calf_sex', 'is', null)
    .order('tag_number')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const mismatched = (data ?? []).filter(a => {
    if (a.calf_sex === 'heifer_calf' && (a.sex === 'bull' || a.sex === 'steer')) return true
    if (a.calf_sex === 'bull_calf'   && (a.sex === 'heifer' || a.sex === 'cow')) return true
    return false
  })

  return NextResponse.json({ data: mismatched })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = createAdminClient()

  if (body.auto_fix) {
    const { data: mismatched } = await supabase
      .from('animals')
      .select('id, calf_sex, sex')
      .not('calf_sex', 'is', null)

    const fixes = (mismatched ?? []).filter(a => {
      if (a.calf_sex === 'heifer_calf' && (a.sex === 'bull' || a.sex === 'steer')) return true
      if (a.calf_sex === 'bull_calf'   && (a.sex === 'heifer' || a.sex === 'cow')) return true
      return false
    })

    let updated = 0
    for (const a of fixes) {
      const correctSex = a.calf_sex === 'heifer_calf' ? 'heifer' : 'bull'
      const { error } = await supabase
        .from('animals')
        .update({ sex: correctSex })
        .eq('id', a.id)
      if (!error) updated++
    }

    return NextResponse.json({ updated })
  }

  const { fixes } = body as { fixes: Array<{ id: string; sex: string }> }
  if (!Array.isArray(fixes)) {
    return NextResponse.json({ error: 'fixes array required' }, { status: 400 })
  }

  let updated = 0
  for (const fix of fixes) {
    const { error } = await supabase
      .from('animals')
      .update({ sex: fix.sex })
      .eq('id', fix.id)
    if (!error) updated++
  }

  return NextResponse.json({ updated })
}
