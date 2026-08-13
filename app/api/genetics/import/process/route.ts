export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!

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
  const { key, stud } = await req.json()

  if (!key) {
    return NextResponse.json({ error: 'key required' }, { status: 400 })
  }

  const pdfUrl      = `${PUBLIC_URL}/${key}`
  const pdfFilename = key.split('/').pop() ?? key

  // Fetch the file from R2
  let buffer: Buffer
  let contentType: string
  try {
    const r2Res = await fetch(pdfUrl)
    if (!r2Res.ok) {
      return NextResponse.json({ error: 'Could not fetch file from storage' }, { status: 502 })
    }
    buffer      = Buffer.from(await r2Res.arrayBuffer())
    contentType = r2Res.headers.get('content-type') ?? 'application/pdf'
  } catch (e) {
    console.error('[process] fetch from R2 failed:', (e as Error).message)
    return NextResponse.json({ error: 'Storage fetch failed' }, { status: 502 })
  }

  const base64 = buffer.toString('base64')
  const isPdf  = contentType.includes('pdf')

  // Send to Claude for extraction
  let responseText: string
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fileBlock: any = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image',    source: { type: 'base64', media_type: contentType, data: base64 } }

    const response = await anthropic.messages.create({
      model:      'claude-opus-4-7',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          fileBlock,
          { type: 'text', text: `${EXTRACTION_PROMPT}\n\nExtract all bull/sire EPD data from this ${stud || 'unknown'} sire directory.` },
        ],
      }],
    })

    responseText = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
  } catch (e) {
    console.error('[process] claude error:', (e as Error).message)
    return NextResponse.json({ error: 'AI extraction failed: ' + (e as Error).message }, { status: 500 })
  }

  const rawText = responseText

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let bulls: any[] = []

  // Strategy 1: direct parse — response starts with [
  if (!bulls.length) {
    try {
      const trimmed = rawText.trim()
      if (trimmed.startsWith('[')) {
        bulls = JSON.parse(trimmed)
      }
    } catch (_) {}
  }

  // Strategy 2: strip markdown fences then parse
  if (!bulls.length) {
    try {
      const stripped = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()
      if (stripped.startsWith('[')) {
        bulls = JSON.parse(stripped)
      }
    } catch (_) {}
  }

  // Strategy 3: find array anywhere in the text
  if (!bulls.length) {
    try {
      const start = rawText.indexOf('[')
      const end   = rawText.lastIndexOf(']')
      if (start !== -1 && end !== -1 && end > start) {
        bulls = JSON.parse(rawText.slice(start, end + 1))
      }
    } catch (_) {}
  }

  // Strategy 4: Claude returned individual objects instead of an array
  if (!bulls.length) {
    try {
      const objects: unknown[] = []
      const regex = /\{[^{}]*\}/g
      let match
      while ((match = regex.exec(rawText)) !== null) {
        try { objects.push(JSON.parse(match[0])) } catch (_) {}
      }
      if (objects.length > 0) {
        bulls = objects
      }
    } catch (_) {}
  }

  if (bulls.length === 0) {
    return NextResponse.json({
      stud:         stud || 'Unknown',
      pdf_url:      pdfUrl,
      pdf_filename: pdfFilename,
      bulls:        [],
      bulls_found:  0,
      warning:      'No bulls could be parsed from AI response',
      raw_sample:   rawText.slice(0, 500),
    })
  }

  return NextResponse.json({
    stud:         stud || 'Unknown',
    pdf_url:      pdfUrl,
    pdf_filename: pdfFilename,
    bulls,
    bulls_found:  bulls.length,
  })
}
