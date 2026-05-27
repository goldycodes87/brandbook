export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

function getUserId(req: NextRequest) {
  return req.cookies.get('brandbook_session')?.value ?? null
}

const DEFAULTS = {
  withdrawal_alerts: true,
  lease_renewal_alerts: true,
  calving_reminders: true,
  weight_reminders: false,
  email_notifications: true,
  alert_lead_days: 7,
}

export async function GET(req: NextRequest) {
  const userId = getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('profile_id', userId)
    .maybeSingle()

  return NextResponse.json({ data: data ?? { ...DEFAULTS, profile_id: userId } })
}

export async function PATCH(req: NextRequest) {
  const userId = getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert({ ...body, profile_id: userId, updated_at: new Date().toISOString() }, { onConflict: 'profile_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
