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

      // Say what is wrong rather than forwarding something that cannot work.
      //
      // The API accepts these four and nothing else, and an iPhone will hand
      // over a HEIC from its library. The app now converts to JPEG before
      // sending, so reaching this line means something else called the route.
      const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      if (!ACCEPTED.includes(media_type)) {
        return NextResponse.json(
          { error: `${media_type} is not a format the reader accepts.` },
          { status: 415 },
        )
      }

      // 10 MB base64 is the per-image ceiling on the first-party API. A
      // camera photograph is 8-9 MB on disk and base64 adds a third, so it
      // lands near 12 MB and is refused — which is why scanning a receipt
      // worked on some days and not others, depending on the photograph.
      // The app downscales before sending now; this is the backstop, and it
      // says so plainly instead of returning "Parse failed".
      const MAX_B64 = 10 * 1024 * 1024
      if (image_base64.length > MAX_B64) {
        return NextResponse.json(
          {
            error:
              `That photo is ${(image_base64.length / 1048576).toFixed(1)} MB encoded, over the 10 MB limit. ` +
              `Update the app and take it again — it will be shrunk before sending.`,
          },
          { status: 413 },
        )
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
    // "Parse failed" told a rancher standing in a feed store nothing, and
    // told whoever read the logs little more. The Anthropic SDK's errors
    // carry a status and a message that name the actual problem — an image
    // over the limit, a key that has been rotated, a rate limit — so pass
    // that through rather than flattening every failure into one sentence.
    const status = (err as { status?: number })?.status
    const detail = (err as { message?: string })?.message ?? ''
    console.error('[parse-expense] error:', status ?? '', detail || err)

    if (status === 401 || status === 403) {
      return NextResponse.json({ error: 'The reader is not authorised — the ranch API key needs attention.' }, { status: 502 })
    }
    if (status === 429) {
      return NextResponse.json({ error: 'The reader is busy. Give it a moment and try again.' }, { status: 429 })
    }
    if (status === 400 && /image/i.test(detail)) {
      return NextResponse.json({ error: 'The reader would not accept that image.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'The reader could not be reached.' }, { status: 502 })
  }
}
