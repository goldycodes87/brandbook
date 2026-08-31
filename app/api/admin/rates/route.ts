export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminSession } from '@/lib/admin-auth'

/**
 * The two rates the ranch charges, kept apart from /api/settings/ranch.
 *
 * A CPA can read this and cannot read that: ranch settings carry the address,
 * the brand and the logo, none of which is any of a bookkeeper's business.
 * Writing only these two columns also means a save here can never blank a
 * field this room does not show.
 */

const RATE_FIELDS = ['ai_tech_fee_per_cow', 'treatment_labor_per_head'] as const

async function ranchRow() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('ranch_settings')
    .select('id, ai_tech_fee_per_cow, treatment_labor_per_head')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data as { id: string; ai_tech_fee_per_cow: number | null; treatment_labor_per_head: number | null } | null
}

export async function GET() {
  const s = await getAdminSession()
  if (!s?.canSeeBilling) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const row = await ranchRow()
  return NextResponse.json({
    data: {
      ai_tech_fee_per_cow:      row?.ai_tech_fee_per_cow      ?? null,
      treatment_labor_per_head: row?.treatment_labor_per_head ?? null,
    },
  })
}

export async function PATCH(req: NextRequest) {
  const s = await getAdminSession()
  if (!s?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const update: Record<string, unknown> = {}

  for (const f of RATE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, f)) continue
    const raw = body[f]
    // Blank is a real answer here — it means "charge nothing for this" — so an
    // empty string becomes null rather than zero.
    if (raw === '' || raw === null) { update[f] = null; continue }
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: 'A rate has to be a number, or blank to charge nothing' }, { status: 400 })
    }
    update[f] = n
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to change' }, { status: 400 })
  }

  const row = await ranchRow()
  if (!row) return NextResponse.json({ error: 'No ranch configured' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('ranch_settings')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', row.id)
    .select('ai_tech_fee_per_cow, treatment_labor_per_head')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
