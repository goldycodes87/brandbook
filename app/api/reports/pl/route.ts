export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any
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

  // Owner's animal IDs
  const { data: ownerAnimals } = await supabase
    .from('animals')
    .select('id')
    .eq('owner_id', owner_id)
  const animalIds = (ownerAnimals ?? []).map((a: any) => a.id)

  // Income: cattle sales
  // TODO switch to sales.owner_id snapshot once the Sale flow adds it
  let salesTotal = 0
  if (animalIds.length > 0) {
    const { data: sales } = await supabase
      .from('sales')
      .select('gross_proceeds')
      .in('animal_id', animalIds)
      .gte('sale_date', yearStart)
      .lte('sale_date', yearEnd)
    salesTotal = (sales ?? []).reduce((s: number, sale: any) => s + (sale.gross_proceeds ?? 0), 0)
  }

  // Expenses: invoices billed to owner (grazing + allocated shared)
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

  // Additional direct expenses (owner_specific and animal_specific not in invoices)
  const { data: ownerExp } = await supabase
    .from('lease_expenses')
    .select('category_name, total_amount')
    .eq('owner_id', owner_id)
    .gte('expense_date', yearStart)
    .lte('expense_date', yearEnd)

  let animalExp: any[] = []
  if (animalIds.length > 0) {
    const { data: ae } = await supabase
      .from('lease_expenses')
      .select('category_name, total_amount')
      .in('animal_id', animalIds)
      .gte('expense_date', yearStart)
      .lte('expense_date', yearEnd)
    animalExp = ae ?? []
  }

  const directExpByCategory: Record<string, number> = {}
  for (const e of [...(ownerExp ?? []), ...animalExp]) {
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
