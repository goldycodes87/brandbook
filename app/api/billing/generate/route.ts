export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

function daysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end   + 'T00:00:00')
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { owner_id, period_start, period_end } = body
  if (!owner_id || !period_start || !period_end) {
    return NextResponse.json({ error: 'owner_id, period_start, and period_end are required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: owner, error: ownerErr } = await (supabase as any)
    .from('grazing_owners').select('id, name, company_name').eq('id', owner_id).single()

  if (ownerErr || !owner) return NextResponse.json({ error: 'Owner not found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: animals } = await (supabase as any)
    .from('animals').select('id').eq('owner_id', owner_id).eq('status', 'active')

  if (!animals?.length) {
    return NextResponse.json({
      line_items: [], animal_count: 0, period_count: 0,
      message: 'No active animals found for this owner',
    })
  }

  // Fetch grazing periods that overlap billing period, find those tied to owner's animals via assignments
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: periods } = await (supabase as any)
    .from('grazing_periods')
    .select('*, lease:leases(id, property_name, rate_type, rate_per_head, rate_per_acre, acreage, flat_rate, rate_per_aum)')
    .lte('start_date', period_end)
    .gte('end_date', period_start)

  const lineItems: Array<{ description: string; amount: number }> = []

  type Period = {
    id: string
    lease_id: string
    start_date: string
    end_date: string
    head_count: number
    lease?: {
      id: string
      property_name: string
      rate_type: string
      rate_per_head?: number
      rate_per_acre?: number
      acreage?: number
      flat_rate?: number
      rate_per_aum?: number
    }
  }

  const grouped: Record<string, Period[]> = {}
  for (const p of (periods ?? []) as Period[]) {
    if (!grouped[p.lease_id]) grouped[p.lease_id] = []
    grouped[p.lease_id].push(p)
  }

  for (const [, lPeriods] of Object.entries(grouped)) {
    const lease = lPeriods[0].lease
    if (!lease) continue

    const totalDays  = lPeriods.reduce((s, p) => s + daysBetween(p.start_date, p.end_date), 0)
    const headCount  = Number(lPeriods[0].head_count) || 0
    let amount       = 0
    let description  = `Grazing — ${lease.property_name}`

    if (lease.rate_type === 'per_head') {
      amount      = headCount * (Number(lease.rate_per_head) || 0) * (totalDays / 30)
      description += ` · ${headCount} head × ${totalDays} days`
    } else if (lease.rate_type === 'per_acre') {
      amount      = ((Number(lease.rate_per_acre) || 0) * (Number(lease.acreage) || 0) / 12) * (totalDays / 30)
      description += ` · ${lease.acreage} acres × ${totalDays} days`
    } else if (lease.rate_type === 'flat') {
      amount      = (Number(lease.flat_rate) || 0) * (totalDays / 30)
      description += ` · ${totalDays} days`
    } else if (lease.rate_type === 'per_aum') {
      amount      = headCount * (Number(lease.rate_per_aum) || 0) * (totalDays / 30)
      description += ` · ${headCount} AUM × ${totalDays} days`
    }

    if (amount >= 0) lineItems.push({ description, amount: Math.round(amount * 100) / 100 })
  }

  return NextResponse.json({
    line_items:   lineItems,
    animal_count: animals.length,
    period_count: periods?.length ?? 0,
    message: lineItems.length > 0
      ? `Found ${lineItems.length} grazing charge${lineItems.length !== 1 ? 's' : ''} from ${periods?.length ?? 0} period${(periods?.length ?? 0) !== 1 ? 's' : ''}`
      : 'No grazing periods found for this date range',
  })
}
