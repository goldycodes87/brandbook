export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const { token, name, password } = await req.json()
  if (!token || !password) return NextResponse.json({ error: 'token and password required' }, { status: 400 })

  const supabase = createAdminClient()

  // Find profile by token
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, invite_accepted_at')
    .eq('invite_token', token)
    .maybeSingle()

  if (!profile) return NextResponse.json({ error: 'Invalid invite token' }, { status: 400 })
  if (profile.invite_accepted_at) return NextResponse.json({ error: 'Invite already accepted' }, { status: 400 })

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: profile.email,
    password,
    email_confirm: true,
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  const newUserId = authData.user.id

  // Update profile: set real auth id, mark accepted
  await supabase.from('profiles').delete().eq('id', profile.id)
  await supabase.from('profiles').insert({
    id: newUserId,
    email: profile.email,
    name: name || profile.email,
    invite_accepted_at: new Date().toISOString(),
    invite_token: null,
  })

  const res = NextResponse.json({ ok: true })
  res.cookies.set('brandbook_session', newUserId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return res
}
