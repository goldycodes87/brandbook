export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminSession } from '@/lib/admin-auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('drug_library')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

// Editing the formulary changes what withdrawal every future treatment is
// measured against, so it is admin work. Use /api/admin/drugs/[id], which
// writes an allowlist; this one stays only because a URL that once accepted
// anything from anyone should not simply keep doing so.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const s = await getAdminSession()
  if (!s?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createAdminClient()
  const body = await req.json()

  // Never allow overriding source via patch
  const { source: _s, ...rest } = body

  const { data, error } = await supabase
    .from('drug_library')
    .update(rest)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
