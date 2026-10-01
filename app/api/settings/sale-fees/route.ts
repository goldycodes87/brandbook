export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminSession } from '@/lib/admin-auth'
import type { Update } from '@/lib/supabase/admin'
import type { Json } from '@/lib/database.types'
import { mergeFeeDefaults, toFeeOverrides, type AppliedFee } from '@/lib/sale-fees'

/**
 * What the sale fee checklist starts out at.
 *
 * Kept beside /api/admin/rates rather than in the general ranch settings for
 * the same reason that one is: this is money the ranch charges, and the people
 * who may read the address and the brand are not the same people who may
 * change what a sale costs an owner.
 *
 * Writes only sale_fee_defaults, so a save here can never blank a field this
 * screen does not show.
 */

async function ranchRow() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('ranch_settings')
    .select('id, sale_fee_defaults')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data as { id: string; sale_fee_defaults: unknown } | null
}

export async function GET() {
  const s = await getAdminSession()
  if (!s?.canSeeBilling) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const row = await ranchRow()
  return NextResponse.json({
    data: mergeFeeDefaults(row?.sale_fee_defaults),
    // So the screen can say whether it is showing the ranch's own figures or
    // the ones it shipped with.
    configured: Array.isArray(row?.sale_fee_defaults),
  })
}

export async function PUT(req: NextRequest) {
  const s = await getAdminSession()
  if (!s?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { fees?: AppliedFee[] }
  if (!Array.isArray(body.fees)) {
    return NextResponse.json({ error: 'Send the fees to save' }, { status: 400 })
  }

  // A negative rate would pay the owner a fee. Clamped rather than refused,
  // because a typed minus sign is a slip, not an instruction.
  const cleaned = body.fees.map(f => ({ ...f, rate: Math.max(0, Number(f.rate) || 0) }))

  const row = await ranchRow()
  if (!row) return NextResponse.json({ error: 'No ranch settings row' }, { status: 500 })

  const supabase = createAdminClient()
  // Through Json: the column is jsonb, and FeeOverride is a plain record of
  // scalars, which the generated Json type cannot see without being told.
  const update: Update<'ranch_settings'> = {
    sale_fee_defaults: toFeeOverrides(cleaned) as unknown as Json,
  }

  const { error } = await supabase.from('ranch_settings').update(update).eq('id', row.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: mergeFeeDefaults(toFeeOverrides(cleaned)), configured: true })
}

/** Put it back to what the app shipped with. */
export async function DELETE() {
  const s = await getAdminSession()
  if (!s?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const row = await ranchRow()
  if (!row) return NextResponse.json({ error: 'No ranch settings row' }, { status: 500 })

  const supabase = createAdminClient()
  const update: Update<'ranch_settings'> = { sale_fee_defaults: null }
  const { error } = await supabase.from('ranch_settings').update(update).eq('id', row.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: mergeFeeDefaults(null), configured: false })
}
