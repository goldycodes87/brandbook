export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('brandbook_vet_session')?.value

  if (!token) {
    return NextResponse.json({ ok: false, error: 'No session' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: invite, error } = await supabase
    .from('vet_invites')
    .select('id, name, email, practice_name, license_number, accepted_at')
    .eq('token', token)
    .maybeSingle()

  if (error || !invite || !invite.accepted_at) {
    return NextResponse.json({ ok: false, error: 'Invalid session' }, { status: 401 })
  }

  return NextResponse.json({ ok: true, vet: invite })
}

export async function DELETE(_req: NextRequest) {
  const cookieStore = await cookies()
  cookieStore.delete('brandbook_vet_session')
  return NextResponse.json({ ok: true })
}
