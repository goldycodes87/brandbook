export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PROMPT = `You are parsing a semen purchase invoice for a cattle ranch.
Extract every straw purchase line item. Semen invoices list a bull name, a NAAB or stud code, unit quantity, and unit price per straw.

Respond ONLY with valid JSON, no markdown, no extra text:
{
  "rows": [
    {
      "sire_name": "bull name as written on the invoice",
      "naab_code": "NAAB or stud code such as 7HO12345, or null if not shown",
      "quantity": <integer number of straws purchased>,
      "price_per_straw": <price per individual straw as a number, or null if not shown>,
      "straw_size": "0.5cc or 0.25cc or null if not specified",
      "is_sexed": <true if labeled sexed or sorted semen, false otherwise>
    }
  ]
}

If no straw line items are found, return { "rows": [] }.
Do not include shipping, handling, or non-straw line items.`

const VALID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { file_base64, media_type } = body as { file_base64: string; media_type: string }

  if (!file_base64 || !media_type) {
    return NextResponse.json({ error: 'file_base64 and media_type required' }, { status: 400 })
  }

  const isPdf = media_type === 'application/pdf'
  if (!isPdf && !VALID_IMAGE_TYPES.includes(media_type)) {
    return NextResponse.json(
      { error: 'media_type must be application/pdf, image/jpeg, image/png, image/webp, or image/gif' },
      { status: 400 }
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fileBlock: any = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file_base64 } }
    : { type: 'image',    source: { type: 'base64', media_type,                    data: file_base64 } }

  try {
    const message = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role:    'user',
        content: [fileBlock, { type: 'text', text: PROMPT }],
      }],
    })

    const text      = message.content.find(b => b.type === 'text')?.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ rows: [] })

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json({ rows: parsed.rows ?? [] })
  } catch (err) {
    console.error('[parse-semen] error:', err)
    return NextResponse.json({ error: 'Parse failed' }, { status: 500 })
  }
}
