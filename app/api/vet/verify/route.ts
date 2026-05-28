export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: invite, error } = await supabase
    .from('vet_invites')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (error || !invite) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 })
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Token has expired' }, { status: 410 })
  }

  // Check if vet has already set up their account
  const needsSetup = !invite.accepted_at

  // Check for existing session
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('brandbook_vet_session')?.value

  let isAuthenticated = false
  if (sessionToken === token) {
    isAuthenticated = true
  }

  return NextResponse.json({
    ok: true,
    needsSetup,
    isAuthenticated,
    invite: {
      name: invite.name,
      email: invite.email,
      practice_name: invite.practice_name,
    },
  })
}
