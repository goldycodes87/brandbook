export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token, name, practice_name, license_number } = body

  if (!token || !name) {
    return NextResponse.json({ error: 'token and name are required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: invite, error } = await supabase
    .from('vet_invites')
    .select('*')
    .eq('token', token)
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
    .update({
      name,
      practice_name: practice_name || null,
      license_number: license_number || null,
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
