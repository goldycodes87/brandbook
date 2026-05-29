export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const VALID_SEX = ['bull', 'cow', 'heifer', 'steer', 'calf']

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('csv') as File | null
  if (!file) return NextResponse.json({ error: 'csv file required' }, { status: 400 })

  const text    = await file.text()
  const lines   = text.trim().split('\n')
  if (lines.length < 2) return NextResponse.json({ error: 'CSV has no data rows' }, { status: 400 })

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase())
  const rows    = lines.slice(1)
    .map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/"/g, ''))
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] || null]))
    })
    .filter(r => r.tag_number)

  const supabase = createAdminClient()
  const errors: string[] = []
  const inserts: Record<string, unknown>[] = []

  for (const row of rows) {
    if (!row.tag_number) { errors.push('Row missing tag_number'); continue }
    if (row.sex && !VALID_SEX.includes(String(row.sex).toLowerCase())) {
      errors.push(`Tag ${row.tag_number}: invalid sex "${row.sex}"`)
      continue
    }
    inserts.push({
      tag_number:       String(row.tag_number),
      name:             row.name || null,
      sex:              row.sex ? String(row.sex).toLowerCase() : null,
      dob:              row.dob || null,
      ear_tag_color:    row.ear_tag_color || null,
      breed:            row.breed || null,
      birth_weight_lbs: row.birth_weight_lbs ? Number(row.birth_weight_lbs) : null,
      purchase_price:   row.purchase_price ? Number(row.purchase_price) : null,
      purchase_date:    row.purchase_date || null,
      vendor:           row.vendor || null,
      notes:            row.notes || null,
      status:           'active',
    })
  }

  if (inserts.length === 0) {
    return NextResponse.json({ imported: 0, skipped: rows.length, errors })
  }

  const { error: insertErr, data } = await supabase
    .from('animals')
    .insert(inserts)
    .select('id')

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  return NextResponse.json({
    imported: data?.length ?? inserts.length,
    skipped:  rows.length - inserts.length,
    errors,
  }, { status: 201 })
}
