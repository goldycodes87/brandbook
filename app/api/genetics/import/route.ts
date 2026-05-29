export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { uploadToR2 } from '@/lib/r2'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const EXTRACTION_PROMPT = `You are a cattle genetics data extractor. Extract all bull/sire records from this sire directory PDF.

For each bull return a JSON object in this exact shape:
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
  console.log('[import] route hit')
  console.log('[import] method:', req.method)

  const formData = await req.formData().catch(e => {
    console.error('[import] formData error:', e.message)
    return null
  })

  console.log('[import] formData:', !!formData)

  const file = formData?.get('file') as File | null
  const stud = (formData?.get('stud') as string) || 'Unknown'

  console.log('[import] file:', file?.name, file?.size)
  console.log('[import] stud:', stud)

  if (!file) {
    console.error('[import] no file received')
    return NextResponse.json({ error: 'No file received' }, { status: 400 })
  }

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
    console.log('[import] uploaded to R2:', pdfUrl)
  } catch (e) {
    console.error('[import] R2 upload failed (non-fatal):', (e as Error).message)
  }

  const base64 = buffer.toString('base64')
  const isPdf  = file.type === 'application/pdf'

  let responseText: string
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fileBlock: any = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: file.type, data: base64 } }

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            fileBlock,
            { type: 'text', text: `${EXTRACTION_PROMPT}\n\nExtract all bull/sire EPD data from this ${stud} sire directory PDF.` },
          ],
        },
      ],
    })

    console.log('[import] claude response stop_reason:', response.stop_reason)
    console.log('[import] content blocks:', response.content.length)

    responseText = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
  } catch (e) {
    console.error('[import] claude error:', (e as Error).message)
    return NextResponse.json({ error: 'AI extraction failed: ' + (e as Error).message }, { status: 500 })
  }

  // Parse extracted JSON
  let bulls: unknown[]
  try {
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    bulls = JSON.parse(cleaned)
    if (!Array.isArray(bulls)) bulls = []
  } catch {
    return NextResponse.json({ error: 'Could not parse AI response as JSON', raw: responseText }, { status: 422 })
  }

  console.log('[import] bulls found:', bulls.length)

  return NextResponse.json({
    stud,
    pdf_url: pdfUrl,
    pdf_filename: file.name,
    bulls,
  })
}
