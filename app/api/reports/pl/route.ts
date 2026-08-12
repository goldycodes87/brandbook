export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const owner_id = searchParams.get('owner_id') ?? ''
  const year     = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()), 10)

  if (!owner_id) return NextResponse.json({ error: 'owner_id required' }, { status: 400 })

  const yearStart = `${year}-01-01`
  const yearEnd   = `${year}-12-31`

  const { data: owner } = await supabase
    .from('grazing_owners')
    .select('id, name, owner_name, company_name')
    .eq('id', owner_id)
    .single()

  if (!owner) return NextResponse.json({ error: 'Owner not found' }, { status: 404 })

  // Income: cattle sales — primary via owner_id snapshot, fallback via animal ownership
  let salesTotal = 0

  const { data: snapshotSales } = await supabase
    .from('sales')
    .select('gross_proceeds')
    .eq('owner_id', owner_id)
    .gte('sale_date', yearStart)
    .lte('sale_date', yearEnd)
    .not('owner_id', 'is', null)

  salesTotal += (snapshotSales ?? []).reduce((s: number, x: any) => s + (x.gross_proceeds ?? 0), 0)

  // Fallback for legacy rows (no snapshot)
  const { data: ownerAnimals } = await supabase
    .from('animals')
    .select('id')
    .eq('owner_id', owner_id)
  const animalIds = (ownerAnimals ?? []).map((a: any) => a.id)

  if (animalIds.length > 0) {
    const { data: legacySales } = await supabase
      .from('sales')
      .select('gross_proceeds')
      .in('animal_id', animalIds)
      .is('owner_id', null)
      .gte('sale_date', yearStart)
      .lte('sale_date', yearEnd)
    salesTotal += (legacySales ?? []).reduce((s: number, x: any) => s + (x.gross_proceeds ?? 0), 0)
  }

  // Expenses: invoices billed to owner
  const { data: invoices } = await supabase
    .from('invoices')
    .select('total_amount, status')
    .eq('owner_id', owner_id)
    .gte('period_start', yearStart)
    .lte('period_start', yearEnd)

  const grazingBilled = (invoices ?? []).reduce((s: number, inv: any) => s + (inv.total_amount ?? 0), 0)
  const grazingPaid   = (invoices ?? [])
    .filter((inv: any) => inv.status === 'paid')
    .reduce((s: number, inv: any) => s + (inv.total_amount ?? 0), 0)

  // Direct expenses
  const { data: ownerExp } = await supabase
    .from('lease_expenses')
    .select('id, category_name, total_amount')
    .eq('owner_id', owner_id)
    .gte('expense_date', yearStart)
    .lte('expense_date', yearEnd)

  let animalExp: any[] = []
  if (animalIds.length > 0) {
    const { data: ae } = await supabase
      .from('lease_expenses')
      .select('id, category_name, total_amount')
      .in('animal_id', animalIds)
      .gte('expense_date', yearStart)
      .lte('expense_date', yearEnd)
    animalExp = ae ?? []
  }

  // Deduplicate by row id: an animal-specific split carries BOTH owner_id and
  // animal_id, so it matches both queries and would otherwise be double-counted.
  const seenExpenseIds = new Set<string>()
  const directExpByCategory: Record<string, number> = {}
  for (const e of [...(ownerExp ?? []), ...animalExp]) {
    if (e?.id) {
      if (seenExpenseIds.has(e.id)) continue
      seenExpenseIds.add(e.id)
    }
    directExpByCategory[e.category_name] = (directExpByCategory[e.category_name] ?? 0) + e.total_amount
  }
  const directExpTotal = Object.values(directExpByCategory).reduce((s, v) => s + v, 0)

  const totalExpenses = grazingBilled + directExpTotal
  const netPL         = salesTotal - totalExpenses

  return NextResponse.json({
    owner: { id: owner.id, name: owner.company_name || owner.owner_name || owner.name },
    year,
    income: { sales: salesTotal },
    expenses: {
      grazing: grazingBilled,
      grazingPaid,
      direct: Object.entries(directExpByCategory)
        .map(([label, total]) => ({ label, total }))
        .sort((a, b) => b.total - a.total),
      directTotal: directExpTotal,
      total: totalExpenses,
    },
    netPL,
  })
}
