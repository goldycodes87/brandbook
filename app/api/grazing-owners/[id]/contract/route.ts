export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('grazing_contracts')
    .select('*')
    .eq('owner_id', id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? null })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json()
  const supabase = createAdminClient()

  // Deactivate any existing active contracts
  await supabase
    .from('grazing_contracts')
    .update({ is_active: false })
    .eq('owner_id', id)
    .eq('is_active', true)

  const { data, error } = await supabase
    .from('grazing_contracts')
    .insert({
      owner_id:                      id,
      is_active:                     true,
      effective_date:                body.effective_date              || null,
      expiration_date:               body.expiration_date             || null,
      calf_share_pct:                body.calf_share_pct              ?? null,
      calf_share_rounding:           body.calf_share_rounding         || null,
      calf_selection_method:         body.calf_selection_method       || null,
      calf_transfer_basis:           body.calf_transfer_basis         || null,
      carry_forward_shortfall:       body.carry_forward_shortfall     ?? true,
      calf_shortfall_carried:        body.calf_shortfall_carried      ?? 0,
      shortfall_from_year:           body.shortfall_from_year         ?? null,
      death_loss_allowable_pct:      body.death_loss_allowable_pct    ?? 10,
      death_loss_split_threshold_pct:body.death_loss_split_threshold_pct ?? 25,
      sale_fee_auction_pct:          body.sale_fee_auction_pct        ?? 3,
      sale_fee_private_flat:         body.sale_fee_private_flat       ?? 350,
      billing_cycle:                 body.billing_cycle               || null,
      expense_share_method:          body.expense_share_method        || null,
      expense_share_pct:             body.expense_share_pct           ?? null,
      rate_per_head_month:           body.rate_per_head_month         ?? null,
      notes:                         body.notes                       || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json()
  const supabase = createAdminClient()

  const { data: contract } = await supabase
    .from('grazing_contracts')
    .select('id')
    .eq('owner_id', id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!contract) return NextResponse.json({ error: 'No active contract found' }, { status: 404 })

  const allowed = [
    'effective_date', 'expiration_date', 'calf_share_pct', 'calf_share_rounding',
    'calf_selection_method', 'calf_transfer_basis', 'carry_forward_shortfall',
    'calf_shortfall_carried', 'shortfall_from_year', 'death_loss_allowable_pct',
    'death_loss_split_threshold_pct', 'sale_fee_auction_pct', 'sale_fee_private_flat',
    'billing_cycle', 'expense_share_method', 'expense_share_pct', 'rate_per_head_month', 'notes',
  ]
  const updates: Record<string, unknown> = {}
  for (const f of allowed) {
    if (f in body) updates[f] = body[f] === '' ? null : body[f]
  }

  const { data, error } = await supabase
    .from('grazing_contracts')
    .update(updates)
    .eq('id', contract.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
