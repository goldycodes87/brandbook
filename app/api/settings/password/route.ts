export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySessionValue } from '@/lib/session-cookie'

/**
 * Setting a new password.
 *
 * Deliberately does NOT ask for the current one. Somebody arriving here has
 * just proved control of the account's inbox by spending a one-time link, and
 * the whole point of that link is that they do not know the old password.
 * Demanding it would make the recovery path a dead end.
 *
 * What stands in for it is the session cookie: signed, httpOnly, and set by a
 * link that expired in twenty minutes and worked once.
 */
export async function PATCH(req: NextRequest) {
  const jar = await cookies()
  const authUserId = await verifySessionValue(jar.get('brandbook_session')?.value)
  if (!authUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const password = typeof body.password === 'string' ? body.password : ''

  // Supabase's own floor is 6. Twelve, because this is the account that can
  // read every animal, every invoice and every owner's balance — and because a
  // long passphrase is easier to type on a phone than a short cryptic one.
  if (password.length < 12) {
    return NextResponse.json(
      { error: 'Use at least 12 characters. A short sentence you will remember beats a clever short one.' },
      { status: 400 },
    )
  }

  const supabase = createAdminClient()
  const { error } = await supabase.auth.admin.updateUserById(authUserId, { password })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
