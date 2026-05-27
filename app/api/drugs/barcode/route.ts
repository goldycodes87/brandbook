export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import OpenAI from 'openai'

const AI_PROMPT = `You are a veterinary drug database assistant. Given a barcode or NDC code, return a JSON object with these fields if you can identify the drug (omit unknown fields):
- brand_name (string)
- generic_name (string)
- manufacturer (string)
- ndc_code (string)
- route (string, e.g. "Injectable", "Topical pour-on")
- drug_class (string)
- withdrawal_days_meat (number)
- withdrawal_days_milk (number)
- dosage_info (string)
Only return valid JSON, no explanation.`

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 })

  // Try exact barcode match first, then NDC
  const { data: byBarcode } = await supabase
    .from('drug_library')
    .select('*')
    .eq('barcode', code)
    .eq('is_active', true)
    .single()

  if (byBarcode) {
    await supabase.from('drug_library').update({ use_count: (byBarcode.use_count ?? 0) + 1 }).eq('id', byBarcode.id)
    return NextResponse.json({ ...byBarcode, source: 'library' })
  }

  const { data: byNdc } = await supabase
    .from('drug_library')
    .select('*')
    .eq('ndc_code', code)
    .eq('is_active', true)
    .single()

  if (byNdc) {
    await supabase.from('drug_library').update({ use_count: (byNdc.use_count ?? 0) + 1 }).eq('id', byNdc.id)
    return NextResponse.json({ ...byNdc, source: 'library' })
  }

  // AI fallback
  try {
    const openai = new OpenAI()
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: AI_PROMPT },
        { role: 'user', content: `Barcode / NDC: ${code}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    })
    const fields = JSON.parse(completion.choices[0].message.content ?? '{}')
    if (fields.brand_name) {
      return NextResponse.json({ ...fields, source: 'ai', ndc_code: code })
    }
  } catch {
    // AI fallback failed — return not found
  }

  return NextResponse.json({ error: 'Drug not found' }, { status: 404 })
}
