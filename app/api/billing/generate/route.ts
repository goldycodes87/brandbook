export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end   + 'T00:00:00')
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1
}

function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const AUM_FACTORS: Record<string, number> = {
  bull: 1.5, cow: 1.0, heifer: 0.75, steer: 0.75, calf: 0.5,
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Animal {
  id: string
  sex: string | null
  owner_id: string | null
  weaning_date: string | null
  dam_id: string | null
  ear_tag_color: string | null
  tag_number: string
}

interface Lease {
  id: string
  property_name: string | null
  rate_type: string | null
  rate_per_head: number | null
  rate_per_acre: number | null
  acreage: number | null
  flat_rate: number | null
  rate_per_aum: number | null
  total_aum_capacity: number | null
}

interface GrazingPeriod {
  id: string
  lease_id: string
  start_date: string
  end_date: string
  head_count: number
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { owner_id, lease_id, period_start, period_end } = body

  if (!owner_id || !lease_id || !period_start || !period_end) {
    return NextResponse.json(
      { error: 'owner_id, lease_id, period_start, and period_end are required' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // ── STEP 1: Fetch lease details ──────────────────────────────────────────────
  const { data: lease, error: leaseErr } = await supabase
    .from('leases')
    .select('id, property_name, rate_type, rate_per_head, rate_per_acre, acreage, flat_rate, rate_per_aum, total_aum_capacity')
    .eq('id', lease_id)
    .single()

  if (leaseErr || !lease) return NextResponse.json({ error: 'Lease not found' }, { status: 404 })

  // ── STEP 2: Fetch owner details ──────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: owner, error: ownerErr } = await (supabase as any)
    .from('grazing_owners')
    .select('id, name, company_name, owner_name, email')
    .eq('id', owner_id)
    .single()

  if (ownerErr || !owner) return NextResponse.json({ error: 'Owner not found' }, { status: 404 })

  // ── STEP 3: Fetch ALL active animals on this lease ───────────────────────────
  const today = new Date().toISOString().slice(0, 10)

  const { data: assignments, error: assignErr } = await supabase
    .from('grazing_assignments')
    .select('animal_id')
    .eq('lease_id', lease_id)
    .or(`end_date.is.null,end_date.gte.${today}`)

  if (assignErr) return NextResponse.json({ error: assignErr.message }, { status: 500 })

  const animalIds = (assignments ?? []).map((a: { animal_id: string }) => a.animal_id)

  let allAnimals: Animal[] = []
  if (animalIds.length > 0) {
    const { data: animals, error: animalErr } = await supabase
      .from('animals')
      .select('id, sex, owner_id, weaning_date, dam_id, ear_tag_color, tag_number')
      .in('id', animalIds)
      .eq('status', 'active')

    if (animalErr) return NextResponse.json({ error: animalErr.message }, { status: 500 })
    allAnimals = (animals ?? []) as Animal[]
  }

  // Identify and exclude unweaned calves
  const unweanedCalfIds = new Set(
    allAnimals
      .filter(a => a.sex?.toLowerCase() === 'calf' && !a.weaning_date && a.dam_id)
      .map(a => a.id)
  )

  const billableAnimals = allAnimals.filter(a => !unweanedCalfIds.has(a.id))
  const totalUnits      = billableAnimals.length

  // ── STEP 4: Filter to this owner's animals ───────────────────────────────────
  const ownerAnimals = billableAnimals.filter(a => a.owner_id === owner_id)
  const ownerUnits   = ownerAnimals.length
  const ownerPct     = totalUnits > 0 ? (ownerUnits / totalUnits) * 100 : 0

  // ── STEP 5: Calculate days in period ────────────────────────────────────────
  const days = daysBetween(period_start, period_end)

  // ── STEP 6: Generate grazing line items ─────────────────────────────────────
  const propertyName = lease.property_name || 'Lease'
  const lineItems: Array<{ description: string; amount: number }> = []

  const rateType = (lease as Lease).rate_type

  if (rateType === 'per_head') {
    const rate = Number((lease as Lease).rate_per_head) || 0
    const cost = ownerUnits * rate * (days / 30)
    if (ownerUnits > 0) {
      lineItems.push({
        description: `Grazing — ${propertyName} · ${ownerUnits} head × $${rate}/head/mo × ${days} days`,
        amount: Math.round(cost * 100) / 100,
      })
    }
  } else if (rateType === 'per_acre') {
    const monthlyLeaseCost = (Number((lease as Lease).rate_per_acre) || 0) * (Number((lease as Lease).acreage) || 0) / 12
    const periodCost       = monthlyLeaseCost * (days / 30)
    const ownerCost        = periodCost * (ownerPct / 100)
    if (ownerCost > 0) {
      lineItems.push({
        description: `Grazing — ${propertyName} · ${ownerPct.toFixed(1)}% of lease (${ownerUnits} of ${totalUnits} head) × ${days} days`,
        amount: Math.round(ownerCost * 100) / 100,
      })
    }
  } else if (rateType === 'flat') {
    const monthlyRate = Number((lease as Lease).flat_rate) || 0
    const periodCost  = monthlyRate * (days / 30)
    const ownerCost   = periodCost * (ownerPct / 100)
    if (ownerCost > 0) {
      lineItems.push({
        description: `Grazing — ${propertyName} · ${ownerPct.toFixed(1)}% of flat rate × ${days} days`,
        amount: Math.round(ownerCost * 100) / 100,
      })
    }
  } else if (rateType === 'per_aum') {
    const ratePerAum = Number((lease as Lease).rate_per_aum) || 0
    const ownerAums  = ownerAnimals.reduce((sum, a) => sum + (AUM_FACTORS[(a.sex ?? '').toLowerCase()] ?? 1.0), 0)
    const cost       = ownerAums * ratePerAum * (days / 30)
    if (ownerAums > 0) {
      lineItems.push({
        description: `Grazing — ${propertyName} · ${ownerAums.toFixed(1)} AUMs × $${ratePerAum}/AUM × ${days} days`,
        amount: Math.round(cost * 100) / 100,
      })
    }
  }

  // ── STEP 7: Check for logged grazing periods (override per_head if present) ──
  const { data: periods } = await supabase
    .from('grazing_periods')
    .select('*')
    .eq('lease_id', lease_id)
    .gte('start_date', period_start)
    .lte('end_date', period_end)
    .order('start_date')

  if ((periods ?? []).length > 0 && rateType === 'per_head') {
    // Use logged periods instead of flat calculation
    lineItems.length = 0
    const ratePerHead = Number((lease as Lease).rate_per_head) || 0

    for (const p of (periods ?? []) as GrazingPeriod[]) {
      const ownerHeadInPeriod = Math.round(p.head_count * (ownerPct / 100))
      if (ownerHeadInPeriod === 0) continue
      const periodDays = daysBetween(p.start_date, p.end_date)
      const cost = ownerHeadInPeriod * ratePerHead * (periodDays / 30)
      lineItems.push({
        description: `Grazing — ${propertyName} · ${ownerHeadInPeriod} head × $${ratePerHead}/head/mo × ${periodDays} days (${fmtDate(p.start_date)} – ${fmtDate(p.end_date)})`,
        amount: Math.round(cost * 100) / 100,
      })
    }
  }

  // ── STEP 8: Fetch lease expenses for period ──────────────────────────────────
  const expenseSplits: Array<{
    category_name: string
    description: string
    total_amount: number
    split_type: string
    split_value: number
    owner_amount: number
    expense_date: string | null
  }> = []

  if (ownerPct > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: leaseExpenses } = await (supabase as any)
      .from('lease_expenses')
      .select('*')
      .eq('lease_id', lease_id)
      .gte('expense_date', period_start)
      .lte('expense_date', period_end)
      .order('expense_date')

    for (const exp of (leaseExpenses ?? []) as Array<{
      category_name: string; description: string | null; total_amount: number; expense_date: string | null
    }>) {
      const ownerAmount = Math.round(exp.total_amount * (ownerPct / 100) * 100) / 100
      expenseSplits.push({
        category_name: exp.category_name,
        description:   exp.description ?? exp.category_name,
        total_amount:  exp.total_amount,
        split_type:    'percentage',
        split_value:   ownerPct,
        owner_amount:  ownerAmount,
        expense_date:  exp.expense_date,
      })
    }
  }

  // ── STEP 9: Build response ───────────────────────────────────────────────────
  const ownerName    = owner.company_name || owner.owner_name || owner.name
  const suggestedTotal =
    lineItems.reduce((s, i) => s + i.amount, 0) +
    expenseSplits.reduce((s, e) => s + e.owner_amount, 0)

  return NextResponse.json({
    suggested_line_items: lineItems,
    suggested_expenses:   expenseSplits,

    owner: {
      id:    owner.id,
      name:  ownerName,
      email: owner.email,
    },
    lease: {
      id:            lease.id,
      property_name: propertyName,
      rate_type:     rateType,
    },
    herd_summary: {
      total_units:       totalUnits,
      owner_units:       ownerUnits,
      owner_pct:         Math.round(ownerPct * 10) / 10,
      unweaned_excluded: unweanedCalfIds.size,
      periods_used:      (periods ?? []).length > 0 && rateType === 'per_head' ? (periods ?? []).length : 0,
      owner_animals: ownerAnimals.map(a => ({
        tag_number:    a.tag_number,
        sex:           a.sex,
        ear_tag_color: a.ear_tag_color,
      })),
    },
    period: { start: period_start, end: period_end, days },
    suggested_total: Math.round(suggestedTotal * 100) / 100,
  })
}
