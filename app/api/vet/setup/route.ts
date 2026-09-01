export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const body = await req.json()
  // license_number is accepted from the form but not stored here — it belongs
  // on portal_people, not on the invite.
  const { token, name, practice_name } = body

  if (!token || !name) {
    return NextResponse.json({ error: 'token and name are required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: invite, error } = await supabase
    .from('vet_invites')
    .select('*')
    .eq('invite_token', token)
    .maybeSingle()

  if (error || !invite) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Token has expired' }, { status: 410 })
  }

  // Mark invite as accepted
  await supabase
    .from('vet_invites')
    // license_number is not a column on vet_invites — it lives on
    // portal_people, where a vet's licence belongs now. Writing it here made
    // the whole update fail, so the invite was never marked accepted.
    .update({
      name,
      practice_name: practice_name || null,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invite.id)

  // Set session cookie
  const cookieStore = await cookies()
  cookieStore.set('brandbook_vet_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 90, // 90 days
    path: '/',
  })

  return NextResponse.json({ ok: true })
}
