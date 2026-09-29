export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOwnerSession } from '@/lib/owner-auth'

export async function GET() {
  const session = await getOwnerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('animals')
    // photos and dob were missing, which is why every card in the portal
    // showed a cow emoji: the page has rendered a photo since it shipped and
    // was never sent one. Four of Doug's six head have a picture on file.
    .select('id, tag_number, name, sex, breed, status, photos, dob, ear_tag_color')
    .eq('owner_id', session.id)
    .order('tag_number', { ascending: true, nullsFirst: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}
