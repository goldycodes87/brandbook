export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ valid: false, error: 'Missing token' })

  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, email, role, invite_accepted_at, created_at')
    .eq('invite_token', token)
    .maybeSingle()

  if (!profile) return NextResponse.json({ valid: false, error: 'Invalid or expired invite' })
  if (profile.invite_accepted_at) return NextResponse.json({ valid: false, error: 'Invite already accepted' })

  // Check 7-day expiry
  const created = new Date(profile.created_at)
  const ageMs = Date.now() - created.getTime()
  if (ageMs > 7 * 24 * 60 * 60 * 1000) return NextResponse.json({ valid: false, error: 'Invite has expired' })

  const { data: ranch } = await supabase
    .from('ranch_settings')
    .select('ranch_name')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({
    valid: true,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    ranch_name: ranch?.ranch_name || 'Brand Book',
  })
}
