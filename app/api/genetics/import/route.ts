export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { uploadToR2 } from '@/lib/r2'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const SYSTEM_PROMPT = `You are a cattle genetics data extractor. The user will provide a PDF or image from a bull stud catalog or EPD summary sheet.
Extract all bull/sire records you find. For each bull return a JSON object in this exact shape:
{
  "bull_name": string,
  "naab_code": string | null,
  "registration_number": string | null,
  "breed": string | null,
  "birth_year": number | null,
  "epd_bw": number | null,
  "epd_ww": number | null,
  "epd_yw": number | null,
  "epd_milk": number | null,
  "epd_tm": number | null,
  "epd_cw": number | null,
  "epd_rea": number | null,
  "epd_fat": number | null,
  "epd_marbling": number | null,
  "epd_dollar_w": number | null,
  "epd_dollar_f": number | null,
  "epd_dollar_g": number | null,
  "epd_dollar_b": number | null,
  "acc_bw": number | null,
  "acc_ww": number | null,
  "acc_yw": number | null
}

Return ONLY a JSON array of these objects. No markdown, no extra text. If a field is not present, use null.
EPD abbreviations: BW=birth weight, WW=weaning weight, YW=yearling weight, Milk=maternal milk, TM=total maternal, CW=carcass weight, REA=rib eye area, Fat=fat thickness, Marb=marbling.
Dollar values: $W=Weaned Calf Value, $F=Feedlot, $G=Grid, $B=Beef Value.`

export async function POST(req: NextRequest) {
  const formData = req.formData ? await req.formData() : null
  if (!formData) return NextResponse.json({ error: 'Multipart form required' }, { status: 400 })

  const file = formData.get('file') as File | null
  const stud = (formData.get('stud') as string) || 'Unknown'

  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })
  if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Only PDF or image files are supported' }, { status: 400 })
  }

  const bytes  = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Upload to R2 for record-keeping
  let pdfUrl: string | null = null
  try {
    const key = `genetics/imports/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    pdfUrl = await uploadToR2(key, buffer, file.type)
  } catch {
    // non-fatal
  }

  // Convert to base64 for OpenAI
  const base64 = buffer.toString('base64')
  const mimeType = file.type === 'application/pdf' ? 'image/png' : file.type

  // For PDFs we convert first page to image via the prompt
  let response: string
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 4096,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'image_url' as const,
              image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' as const },
            },
            { type: 'text' as const, text: `Extract all bull EPD records from this ${stud} catalog page.` },
          ],
        },
      ],
    })
    response = completion.choices[0]?.message?.content ?? '[]'
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `AI extraction failed: ${msg}` }, { status: 500 })
  }

  // Parse extracted JSON
  let bulls: unknown[]
  try {
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    bulls = JSON.parse(cleaned)
    if (!Array.isArray(bulls)) bulls = []
  } catch {
    return NextResponse.json({ error: 'Could not parse AI response as JSON', raw: response }, { status: 422 })
  }

  return NextResponse.json({
    stud,
    pdf_url: pdfUrl,
    pdf_filename: file.name,
    bulls,
  })
}
