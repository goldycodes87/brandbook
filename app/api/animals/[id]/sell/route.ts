export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body     = await req.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any

  // Fetch current animal state for snapshot
  const { data: animal } = await supabase
    .from('animals')
    .select('id, owner_id, origin')
    .eq('id', id)
    .single()

  if (!animal) return NextResponse.json({ error: 'Animal not found' }, { status: 404 })

  const {
    sale_date       = new Date().toISOString().slice(0, 10),
    buyer           = null,
    destination     = null,
    sale_weight_lbs = null,
    price_per_lb    = null,
    gross_proceeds  = null,
    notes           = null,
    buyer_type      = 'external',  // 'external' | 'internal'
    buyer_owner_id  = null,
  } = body

  // Insert sales row with seller snapshot
  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .insert({
      animal_id:       id,
      sale_date,
      buyer:           buyer    || null,
      destination:     destination || null,
      sale_weight_lbs: sale_weight_lbs ? Number(sale_weight_lbs) : null,
      price_per_lb:    price_per_lb    ? Number(price_per_lb)    : null,
      gross_proceeds:  gross_proceeds  ? Number(gross_proceeds)  : null,
      notes:           notes    || null,
      owner_id:        animal.owner_id,           // seller snapshot
      origin:          animal.origin  || null,    // origin snapshot
      buyer_owner_id:  buyer_owner_id || null,
    })
    .select()
    .single()

  if (saleErr) return NextResponse.json({ error: saleErr.message }, { status: 500 })

  if (buyer_type === 'internal' && buyer_owner_id) {
    // Internal transfer-sale — keep active, reassign owner
    const { error: updateErr } = await supabase
      .from('animals')
      .update({
        owner_id:      buyer_owner_id,
        purchase_price: gross_proceeds ? Number(gross_proceeds) : null,
        purchase_date:  sale_date,
        origin:        'purchased',
      })
      .eq('id', id)
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
  } else {
    // External sale — remove from active herd
    const { error: updateErr } = await supabase
      .from('animals')
      .update({
        status:           'sold',
        disposition:      'sold',
        disposition_date: sale_date,
        disposition_notes: notes || null,
      })
      .eq('id', id)
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, sale }, { status: 201 })
}
