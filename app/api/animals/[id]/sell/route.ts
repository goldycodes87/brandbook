export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body     = await req.json()
  const supabase = createAdminClient()

  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .insert({
      animal_id:       id,
      sale_date:       body.sale_date || new Date().toISOString().slice(0, 10),
      buyer:           body.buyer || null,
      destination:     body.destination || null,
      sale_weight_lbs: body.sale_weight_lbs ? Number(body.sale_weight_lbs) : null,
      price_per_lb:    body.price_per_lb ? Number(body.price_per_lb) : null,
      gross_proceeds:  body.gross_proceeds ? Number(body.gross_proceeds) : null,
      notes:           body.notes || null,
    })
    .select()
    .single()

  if (saleErr) return NextResponse.json({ error: saleErr.message }, { status: 500 })

  const { error: updateErr } = await supabase
    .from('animals')
    .update({ status: 'sold' })
    .eq('id', id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, sale }, { status: 201 })
}
