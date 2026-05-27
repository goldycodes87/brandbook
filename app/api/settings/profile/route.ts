export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

function getUserId(req: NextRequest) {
  return req.cookies.get('brandbook_session')?.value ?? null
}

export async function GET(req: NextRequest) {
  const userId = getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const [{ data: { user } }, { data: profile }] = await Promise.all([
    supabase.auth.admin.getUserById(userId),
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
  ])

  return NextResponse.json({ user, profile })
}

export async function PATCH(req: NextRequest) {
  const userId = getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const body = await req.json()
  const allowed: Record<string, unknown> = {}
  if ('name'       in body) allowed.name       = body.name
  if ('phone'      in body) allowed.phone      = body.phone
  if ('avatar_url' in body) allowed.avatar_url = body.avatar_url

  const { data, error } = await supabase
    .from('profiles')
    .update(allowed)
    .eq('id', userId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
