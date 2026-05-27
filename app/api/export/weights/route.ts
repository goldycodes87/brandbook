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
    .from('weights')
    .select('animal_id, weight_lbs, weighed_at, source, notes, animals(tag_number)')
    .order('weighed_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []).map(r => ({
    ...r,
    tag_number: (r.animals as unknown as { tag_number: string } | null)?.tag_number ?? '',
  }))

  const csv = toCSV(rows, [
    { key: 'tag_number', label: 'Tag Number' },
    { key: 'weight_lbs', label: 'Weight (lbs)' },
    { key: 'weighed_at', label: 'Weighed At' },
    { key: 'source',     label: 'Source' },
    { key: 'notes',      label: 'Notes' },
  ])

  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="weights-${date}.csv"`,
    },
  })
}
