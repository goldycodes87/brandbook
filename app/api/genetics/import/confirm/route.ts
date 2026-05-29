export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const body     = await req.json()
  const supabase = createAdminClient()

  const { stud, pdf_url, pdf_filename, bulls } = body

  if (!Array.isArray(bulls) || bulls.length === 0) {
    return NextResponse.json({ error: 'No bulls to import' }, { status: 400 })
  }

  // Create import batch record
  const { data: batch, error: batchErr } = await (supabase as any)
    .from('sire_import_batches')
    .insert({
      stud:          stud || 'Unknown',
      pdf_url:       pdf_url || null,
      pdf_filename:  pdf_filename || null,
      status:        'processing',
      bulls_found:   bulls.length,
      bulls_imported: 0,
    })
    .select()
    .single()

  if (batchErr) return NextResponse.json({ error: batchErr.message }, { status: 500 })

  // Insert sire records
  const rows = bulls.map((b: Record<string, unknown>) => ({
    bull_name:           String(b.bull_name || '').trim() || 'Unknown',
    bull_type:           'ai_sire',
    breed:               b.breed || null,
    registration_number: b.registration_number || null,
    naab_code:           b.naab_code || null,
    stud:                stud || null,
    birth_year:          b.birth_year ? Number(b.birth_year) : null,
    is_active:           true,
    source:              'pdf_import',
    epd_source:          'pdf_import',
    epd_updated_at:      new Date().toISOString(),
    import_batch_id:     batch.id,
    epd_bw:       toNum(b.epd_bw),       epd_ww:    toNum(b.epd_ww),
    epd_yw:       toNum(b.epd_yw),       epd_milk:  toNum(b.epd_milk),
    epd_tm:       toNum(b.epd_tm),       epd_cw:    toNum(b.epd_cw),
    epd_rea:      toNum(b.epd_rea),      epd_fat:   toNum(b.epd_fat),
    epd_marbling: toNum(b.epd_marbling),
    epd_dollar_w: toNum(b.epd_dollar_w), epd_dollar_f: toNum(b.epd_dollar_f),
    epd_dollar_g: toNum(b.epd_dollar_g), epd_dollar_b: toNum(b.epd_dollar_b),
    acc_bw:       toNum(b.acc_bw),       acc_ww:    toNum(b.acc_ww),
    acc_yw:       toNum(b.acc_yw),
  }))

  const { error: insertErr, count } = await (supabase as any)
    .from('sire_library')
    .insert(rows)

  if (insertErr) {
    await (supabase as any)
      .from('sire_import_batches')
      .update({ status: 'failed', error_text: insertErr.message })
      .eq('id', batch.id)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  await (supabase as any)
    .from('sire_import_batches')
    .update({ status: 'complete', bulls_imported: rows.length })
    .eq('id', batch.id)

  return NextResponse.json({ batch_id: batch.id, imported: rows.length }, { status: 201 })
}

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}
