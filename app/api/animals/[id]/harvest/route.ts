export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body     = await req.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any

  const {
    harvest_date     = new Date().toISOString().slice(0, 10),
    destination      = null,
    final_weight_lbs = null,
    notes            = null,
  } = body

  // TODO: sync to Legacy Beef app (webhook/shared table)
  // beef_production_flagged_at signals this animal is ready for beef sync

  const dispositionNotes = [
    destination ? `Locker: ${destination}` : null,
    notes || null,
  ].filter(Boolean).join(' — ') || null

  const { error } = await supabase
    .from('animals')
    .update({
      status:                    'harvested',
      disposition:               'harvested',
      disposition_date:          harvest_date,
      disposition_notes:         dispositionNotes,
      beef_production_flagged_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (final_weight_lbs) {
    await supabase.from('weights').insert({
      animal_id:  id,
      weight_lbs: Number(final_weight_lbs),
      weighed_at: harvest_date,
      source:     'harvest',
      notes:      'Final weight at harvest',
    })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
