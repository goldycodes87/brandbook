export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()), 10)

  const yearStart = `${year}-01-01`
  const yearEnd   = `${year}-12-31`

  // All invoices for the year
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, owner_id, total_amount, status, period_start, period_end, invoice_number')
    .gte('period_start', yearStart)
    .lte('period_start', yearEnd)
    .order('owner_id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch all owners referenced
  const ownerIds = [...new Set((invoices ?? []).map((inv: any) => inv.owner_id).filter(Boolean))]
  let ownerNames: Record<string, string> = {}

  if (ownerIds.length > 0) {
    const { data: owners } = await supabase
      .from('grazing_owners')
      .select('id, name, owner_name, company_name')
      .in('id', ownerIds)
    ownerNames = Object.fromEntries(
      (owners ?? []).map((o: any) => [o.id, o.company_name || o.owner_name || o.name])
    )
  }

  // Group by owner
  const byOwner: Record<string, {
    owner_id: string
    owner_name: string
    totalBilled: number
    totalPaid: number
    invoiceCount: number
    invoices: any[]
  }> = {}

  for (const inv of invoices ?? []) {
    if (!inv.owner_id) continue
    if (!byOwner[inv.owner_id]) {
      byOwner[inv.owner_id] = {
        owner_id:     inv.owner_id,
        owner_name:   ownerNames[inv.owner_id] ?? 'Unknown',
        totalBilled:  0,
        totalPaid:    0,
        invoiceCount: 0,
        invoices:     [],
      }
    }
    const row = byOwner[inv.owner_id]
    row.totalBilled  += inv.total_amount ?? 0
    row.invoiceCount += 1
    if (inv.status === 'paid') row.totalPaid += inv.total_amount ?? 0
    row.invoices.push({
      id:             inv.id,
      invoice_number: inv.invoice_number,
      period_start:   inv.period_start,
      period_end:     inv.period_end,
      total_amount:   inv.total_amount,
      status:         inv.status,
    })
  }

  const summary = Object.values(byOwner).sort((a, b) => a.owner_name.localeCompare(b.owner_name))
  const grandTotal   = summary.reduce((s, o) => s + o.totalBilled, 0)
  const grandPaid    = summary.reduce((s, o) => s + o.totalPaid, 0)
  const grandUnpaid  = grandTotal - grandPaid

  return NextResponse.json({ year, summary, grandTotal, grandPaid, grandUnpaid })
}
