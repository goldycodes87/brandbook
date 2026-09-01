export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { signSessionValue } from '@/lib/session-cookie'

/**
 * Spending a one-time sign-in link.
 *
 * The cookie set here is the same one the password form sets: a signed
 * auth.users id. Nothing about arriving by link grants more than arriving by
 * password — what that id can reach is decided downstream, by getAdminSession
 * reading the person's role, exactly as it would be either way.
 *
 * Single use. The row is stamped BEFORE the cookie is issued, and the update
 * only matches a row that is still unused, so two browsers racing the same
 * link cannot both come away signed in.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (!token) return NextResponse.json({ error: 'That link is not valid' }, { status: 400 })

  const supabase = createAdminClient()

  const { data } = await supabase
    .from('auth_signin_tokens')
    .select('token, auth_user_id, expires_at, used_at')
    .eq('token', token)
    .maybeSingle()

  const row = data as {
    token: string; auth_user_id: string; expires_at: string; used_at: string | null
  } | null

  // One message for every failure. Which of "no such link", "already used" and
  // "expired" applies is not something a stranger needs help distinguishing.
  const refuse = NextResponse.json(
    { error: 'That link has expired or has already been used. Ask for a fresh one.' },
    { status: 401 },
  )

  if (!row) return refuse
  if (row.used_at) return refuse
  if (new Date(row.expires_at) < new Date()) return refuse

  // Claim it. `.is('used_at', null)` makes this the race-safe step: whichever
  // request updates a row first is the one that gets a session.
  const { data: claimed } = await supabase
    .from('auth_signin_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token)
    .is('used_at', null)
    .select('token')
    .maybeSingle()

  if (!claimed) return refuse

  const res = NextResponse.json({ ok: true })
  res.cookies.set('brandbook_session', await signSessionValue(row.auth_user_id), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return res
}
