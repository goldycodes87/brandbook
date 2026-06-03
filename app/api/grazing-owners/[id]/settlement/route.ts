export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const sp = req.nextUrl.searchParams
  const year = sp.get('year')
  const supabase = createAdminClient()

  let query = supabase
    .from('grazing_settlements')
    .select('*')
    .eq('owner_id', id)
    .order('settlement_year', { ascending: false })

  if (year) query = query.eq('settlement_year', Number(year))

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json()
  const supabase = createAdminClient()

  // Fetch active contract for calculations
  const { data: contract } = await supabase
    .from('grazing_contracts')
    .select('*')
    .eq('owner_id', id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const calves_born          = Number(body.calves_born   ?? 0)
  const calves_died          = Number(body.calves_died   ?? 0)
  const calves_weaned        = Number(body.calves_weaned ?? 0)
  const dead_calf_fmv_total  = Number(body.dead_calf_fmv_total ?? 0)
  const gross_calf_sales     = Number(body.gross_calf_sales ?? 0)
  const net_calf_proceeds    = Number(body.net_calf_proceeds_to_owner ?? 0)
  const grazing_fees_total   = Number(body.grazing_fees_total ?? 0)
  const expense_splits_total = Number(body.expense_splits_total ?? 0)
  const sale_fees_charged    = Number(body.sale_fees_charged ?? 0)
  const calf_transfers_fmv   = Number(body.calf_transfers_fmv ?? 0)

  // ── Death loss ────────────────────────────────────────────
  const death_loss_pct = calves_born > 0
    ? Math.round((calves_died / calves_born) * 1000) / 10
    : 0

  const allowable      = contract?.death_loss_allowable_pct      ?? 10
  const splitThreshold = contract?.death_loss_split_threshold_pct ?? 25

  let death_loss_responsibility: string
  let operator_death_loss_share: number
  let owner_death_loss_share:    number

  if (death_loss_pct <= allowable) {
    death_loss_responsibility = 'owner'
    operator_death_loss_share = 0
    owner_death_loss_share    = dead_calf_fmv_total
  } else if (death_loss_pct <= splitThreshold) {
    death_loss_responsibility = 'split'
    operator_death_loss_share = dead_calf_fmv_total * 0.5
    owner_death_loss_share    = dead_calf_fmv_total * 0.5
  } else {
    death_loss_responsibility = 'operator'
    operator_death_loss_share = dead_calf_fmv_total
    owner_death_loss_share    = 0
  }

  // ── Calf share ────────────────────────────────────────────
  const calfSharePct = contract?.calf_share_pct ?? 0
  const rounding     = contract?.calf_share_rounding ?? 'down'
  const rawShare     = calves_weaned * calfSharePct / 100

  let operator_calf_share: number
  if (rounding === 'up')      operator_calf_share = Math.ceil(rawShare)
  else if (rounding === 'nearest') operator_calf_share = Math.round(rawShare)
  else                        operator_calf_share = Math.floor(rawShare)

  // Carry-forward shortfall
  const carryForward       = contract?.carry_forward_shortfall ?? false
  const existingShortfall  = contract?.calf_shortfall_carried  ?? 0
  let adjustedOperatorShare = operator_calf_share

  if (carryForward && existingShortfall > 0) {
    const combined = operator_calf_share + existingShortfall
    adjustedOperatorShare = Math.min(combined, calves_weaned)
  }

  const owner_calf_share       = calves_weaned - adjustedOperatorShare
  const shortfall_carried_forward = Math.max(
    0,
    rawShare - adjustedOperatorShare + (operator_calf_share - adjustedOperatorShare)
  )

  // ── Balance ───────────────────────────────────────────────
  let balance_due_to_operator =
    grazing_fees_total + expense_splits_total + sale_fees_charged +
    operator_death_loss_share - net_calf_proceeds - calf_transfers_fmv

  let balance_due_to_owner = 0
  if (balance_due_to_operator < 0) {
    balance_due_to_owner    = Math.abs(balance_due_to_operator)
    balance_due_to_operator = 0
  }

  const { data, error } = await supabase
    .from('grazing_settlements')
    .insert({
      owner_id:                  id,
      contract_id:               contract?.id                 ?? null,
      settlement_year:           body.settlement_year         ?? new Date().getFullYear(),
      calves_born,
      calves_died,
      calves_weaned,
      dead_calf_fmv_total,
      death_loss_pct,
      death_loss_responsibility,
      operator_death_loss_share,
      owner_death_loss_share,
      operator_calf_share:       adjustedOperatorShare,
      owner_calf_share,
      gross_calf_sales,
      net_calf_proceeds_to_owner: net_calf_proceeds,
      grazing_fees_total,
      expense_splits_total,
      sale_fees_charged,
      calf_transfers_fmv,
      balance_due_to_operator,
      balance_due_to_owner,
      shortfall_carried_forward,
      settlement_notes:          body.settlement_notes        || null,
      is_settled:                false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
