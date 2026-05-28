export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getVetSession } from '@/lib/vet-auth'

export async function GET(req: NextRequest) {
  const vet = await getVetSession()
  if (!vet) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const search = req.nextUrl.searchParams.get('search') ?? ''
  const supabase = createAdminClient()

  let query = supabase
    .from('animals')
    .select('id, tag_number, name, sex, status, breed, dob, ear_tag_color', { count: 'exact' })
    .eq('status', 'active')
    .order('tag_number')
    .limit(50)

  if (search) {
    query = query.or(`tag_number.ilike.%${search}%,name.ilike.%${search}%`)
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, count })
}
