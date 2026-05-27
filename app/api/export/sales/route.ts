export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

function toCSV(rows: Record<string, unknown>[], headers: { key: string; label: string }[]): string {
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const head = headers.map(h => h.label).join(',')
  const body = rows.map(r => headers.map(h => escape(r[h.key])).join(',')).join('\n')
  return `${head}\n${body}`
}

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('sales')
    .select('sale_date, buyer, destination, sale_weight_lbs, price_per_lb, gross_proceeds, notes, created_at, animals(tag_number)')
    .order('sale_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []).map(r => ({
    ...r,
    tag_number: (r.animals as unknown as { tag_number: string } | null)?.tag_number ?? '',
  }))

  const csv = toCSV(rows, [
    { key: 'tag_number',      label: 'Tag Number' },
    { key: 'sale_date',       label: 'Sale Date' },
    { key: 'buyer',           label: 'Buyer' },
    { key: 'destination',     label: 'Destination' },
    { key: 'sale_weight_lbs', label: 'Weight (lbs)' },
    { key: 'price_per_lb',    label: 'Price/lb' },
    { key: 'gross_proceeds',  label: 'Gross Proceeds' },
    { key: 'notes',           label: 'Notes' },
    { key: 'created_at',      label: 'Created At' },
  ])

  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="sales-${date}.csv"`,
    },
  })
}
