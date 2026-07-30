export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PROMPT = `Look at this photo of a cattle ear tag.
Find the tag number — it may be printed, stamped, or written on a plastic or metal ear tag.
The tag number is typically 2–6 digits, sometimes with a letter prefix or suffix.
Respond ONLY with valid JSON, no other text, no markdown:
{"tag_number": "the exact characters visible on the tag, or null if you cannot read it clearly"}`

export async function POST(req: NextRequest) {
  try {
    const { image_base64, media_type } = await req.json()

    if (!image_base64) {
      return NextResponse.json({ error: 'image_base64 required' }, { status: 400 })
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 64,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: media_type ?? 'image/jpeg', data: image_base64 },
          },
          { type: 'text', text: PROMPT },
        ],
      }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}'
    const parsed = JSON.parse(text)
    return NextResponse.json({ tag_number: parsed.tag_number ?? null })
  } catch (err) {
    console.error('[read-tag] error:', err)
    return NextResponse.json({ tag_number: null }, { status: 200 })
  }
}
