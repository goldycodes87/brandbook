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
    .from('animals')
    .select('tag_number, name, sex, status, dob, breed, breed_percentage, birth_weight_lbs, purchase_price, purchase_date, vendor, notes, created_at')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const csv = toCSV(data ?? [], [
    { key: 'tag_number',       label: 'Tag Number' },
    { key: 'name',             label: 'Name' },
    { key: 'sex',              label: 'Sex' },
    { key: 'status',           label: 'Status' },
    { key: 'dob',              label: 'DOB' },
    { key: 'breed',            label: 'Breed' },
    { key: 'breed_percentage', label: 'Breed %' },
    { key: 'birth_weight_lbs', label: 'Birth Weight (lbs)' },
    { key: 'purchase_price',   label: 'Purchase Price' },
    { key: 'purchase_date',    label: 'Purchase Date' },
    { key: 'vendor',           label: 'Vendor' },
    { key: 'notes',            label: 'Notes' },
    { key: 'created_at',       label: 'Created At' },
  ])

  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="animals-${date}.csv"`,
    },
  })
}
