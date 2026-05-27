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
    .from('health_events')
    .select('animal_id, event_type, event_date, drug_name, dose_amount, dose_unit, withdrawal_days, withdrawal_clear_date, bcs_score, administered_by, notes, created_at, animals(tag_number)')
    .order('event_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []).map(r => ({
    ...r,
    tag_number: (r.animals as unknown as { tag_number: string } | null)?.tag_number ?? '',
  }))

  const csv = toCSV(rows, [
    { key: 'tag_number',           label: 'Tag Number' },
    { key: 'event_type',           label: 'Event Type' },
    { key: 'event_date',           label: 'Event Date' },
    { key: 'drug_name',            label: 'Drug' },
    { key: 'dose_amount',          label: 'Dose Amount' },
    { key: 'dose_unit',            label: 'Dose Unit' },
    { key: 'withdrawal_days',      label: 'Withdrawal Days' },
    { key: 'withdrawal_clear_date',label: 'Clear Date' },
    { key: 'bcs_score',            label: 'BCS Score' },
    { key: 'administered_by',      label: 'Administered By' },
    { key: 'notes',                label: 'Notes' },
    { key: 'created_at',           label: 'Created At' },
  ])

  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="health-records-${date}.csv"`,
    },
  })
}
