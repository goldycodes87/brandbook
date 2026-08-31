export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminSession } from '@/lib/admin-auth'

/**
 * People the ranch calls.
 *
 * Separate from portal_people, who have a login. These are phone numbers: the
 * AI technician, the hauler, the brand inspector. Nobody here can sign in, and
 * that is the point — a phone number should not require inviting somebody into
 * your records.
 */

const ROLES = ['ai_tech', 'vet', 'hauler', 'nutritionist', 'brand_inspector', 'auction', 'other'] as const

export async function GET() {
  const s = await getAdminSession()
  if (!s?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('ranch_contacts')
    .select('id, name, role, company, phone, email, notes')
    .eq('is_active', true)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], roles: ROLES })
}

export async function POST(req: NextRequest) {
  const s = await getAdminSession()
  if (!s?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'A name is required' }, { status: 400 })

  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const role = typeof body.role === 'string' && (ROLES as readonly string[]).includes(body.role) ? body.role : 'other'

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('ranch_contacts')
    .insert({
      ranch_id: s.ranchId,
      name,
      role,
      company: str(body.company),
      phone:   str(body.phone),
      email:   str(body.email),
      notes:   str(body.notes),
    })
    .select('id, name, role, company, phone, email, notes')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
