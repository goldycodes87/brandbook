export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const CATEGORIES = [
  'Hay / Forage', 'Protein / Mineral Tubs', 'Salt / Loose Mineral',
  'Pasture Treatment', 'Working Animals', 'Fence Repair',
  'Equipment Rental', 'Labor', 'Water / Utilities', 'Other (Shared)',
  'AI Technician Fee', 'Semen Straws', 'Preg Check', 'Other (Owner Specific)',
  'Vet Bill', 'Medication', 'Veterinary Procedure', 'Other (Animal Specific)',
]

const CATEGORY_STR = CATEGORIES.join(' | ')

const RECEIPT_PROMPT = `You are parsing a receipt for a cattle ranch.
Extract all expense line items from this receipt image.
Respond ONLY with valid JSON, no other text, no markdown:
{
  "vendor": "store name or null",
  "date": "YYYY-MM-DD or null",
  "items": [
    {
      "description": "item name",
      "amount": 0.00,
      "suggested_category": "one of: ${CATEGORY_STR}"
    }
  ],
  "total": 0.00
}`

const TEXT_PROMPT = (text: string) => `Parse this ranch expense entry into structured data.
Respond ONLY with valid JSON, no other text, no markdown:
{
  "items": [
    {
      "description": "item description",
      "amount": 0.00,
      "suggested_category": "one of: ${CATEGORY_STR}",
      "is_lease_specific": false
    }
  ],
  "lease_hint": "lease or pasture name mentioned, or null",
  "date_hint": "YYYY-MM-DD if date mentioned, or null"
}

Input: "${text.replace(/"/g, '\\"')}"`

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { mode } = body as { mode: 'receipt' | 'text' }

  try {
    if (mode === 'receipt') {
      const { image_base64, media_type } = body as {
        image_base64: string
        media_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
      }

      if (!image_base64 || !media_type) {
        return NextResponse.json({ error: 'image_base64 and media_type required' }, { status: 400 })
      }

      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type, data: image_base64 },
            },
            { type: 'text', text: RECEIPT_PROMPT },
          ],
        }],
      })

      const text = message.content.find(b => b.type === 'text')?.text ?? ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return NextResponse.json({ error: 'No JSON in response' }, { status: 422 })
      const parsed = JSON.parse(jsonMatch[0])
      return NextResponse.json(parsed)

    } else if (mode === 'text') {
      const { text } = body as { text: string }
      if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })

      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: TEXT_PROMPT(text),
        }],
      })

      const responseText = message.content.find(b => b.type === 'text')?.text ?? ''
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return NextResponse.json({ error: 'No JSON in response' }, { status: 422 })
      const parsed = JSON.parse(jsonMatch[0])
      return NextResponse.json(parsed)

    } else {
      return NextResponse.json({ error: 'mode must be receipt or text' }, { status: 400 })
    }
  } catch (err) {
    console.error('[parse-expense] error:', err)
    return NextResponse.json({ error: 'Parse failed' }, { status: 500 })
  }
}
