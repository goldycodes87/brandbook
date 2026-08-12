export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { signSessionValue } from '@/lib/session-cookie'

export async function POST(req: NextRequest) {
  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any
  const { data: owner } = await supabase
    .from('grazing_owners')
    .select('id, name, company_name, owner_name')
    .eq('portal_token', token)
    .maybeSingle()

  if (!owner) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

  const name = owner.company_name || owner.owner_name || owner.name || 'Owner'

  const res = NextResponse.json({ ok: true, owner: { id: owner.id, name } })
  res.cookies.set('brandbook_owner_session', await signSessionValue(owner.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 90,
    path: '/',
  })
  return res
}
