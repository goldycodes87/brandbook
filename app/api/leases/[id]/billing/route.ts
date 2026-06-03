export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

function daysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

function calcCost(lease: Record<string, unknown>, period: Record<string, unknown>): number {
  const days = daysBetween(period.start_date as string, period.end_date as string)
  const rateType = lease.rate_type as string
  const headCount = Number(period.head_count) || 0

  if (rateType === 'per_head') {
    return headCount * (Number(lease.rate_per_head) || 0) * days
  }
  if (rateType === 'per_head_month') {
    return headCount * (Number(lease.rate_per_head) || 0) * (days / 30)
  }
  if (rateType === 'per_acre') {
    const monthly = ((Number(lease.rate_per_acre) || 0) * (Number(lease.acreage) || 0)) / 12
    return monthly * (days / 30)
  }
  if (rateType === 'flat') {
    return (Number(lease.flat_rate) || 0) * (days / 30)
  }
  if (rateType === 'per_aum') {
    return headCount * (Number(lease.rate_per_aum) || 0) * (days / 30)
  }
  return 0
}

function rateDescription(lease: Record<string, unknown>): string {
  const rt = lease.rate_type as string
  if (rt === 'per_head') return `$${Number(lease.rate_per_head || 0).toFixed(2)}/head/day`
  if (rt === 'per_head_month') return `$${Number(lease.rate_per_head || 0).toFixed(2)}/head/month`
  if (rt === 'per_acre') return `$${Number(lease.rate_per_acre || 0).toFixed(2)}/acre/year · ${lease.acreage ?? 0} acres`
  if (rt === 'flat')     return `Flat rate: $${Number(lease.flat_rate || 0).toFixed(2)}/month`
  if (rt === 'per_aum')  return `$${Number(lease.rate_per_aum || 0).toFixed(2)}/AUM/month`
  return 'No rate set'
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const [leaseRes, periodsRes] = await Promise.all([
    supabase.from('leases').select('*').eq('id', id).maybeSingle(),
    supabase.from('grazing_periods').select('*').eq('lease_id', id).order('start_date', { ascending: true }),
  ])

  if (leaseRes.error) return NextResponse.json({ error: leaseRes.error.message }, { status: 500 })
  if (!leaseRes.data)  return NextResponse.json({ error: 'Lease not found' }, { status: 404 })
  if (periodsRes.error) return NextResponse.json({ error: periodsRes.error.message }, { status: 500 })

  const lease = leaseRes.data as Record<string, unknown>
  const periods = (periodsRes.data ?? []) as Record<string, unknown>[]

  const periodsWithCosts = periods.map(p => {
    const cost = calcCost(lease, p)
    return { ...p, days: daysBetween(p.start_date as string, p.end_date as string), calculated_cost: cost }
  })

  const total_owed = periodsWithCosts.reduce((s, p) => s + (p.calculated_cost as number), 0)
  const total_paid = periodsWithCosts
    .filter(p => (p as Record<string, unknown>).is_paid)
    .reduce((s, p) => s + (p.calculated_cost as number), 0)
  const total_unpaid = total_owed - total_paid

  return NextResponse.json({
    periods: periodsWithCosts,
    summary: {
      total_owed,
      total_paid,
      total_unpaid,
      period_count: periods.length,
      rate_used: rateDescription(lease),
    },
  })
}
