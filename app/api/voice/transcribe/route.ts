export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI()

const PARSE_PROMPT = `You are a livestock record assistant. Given a voice transcript about an animal, extract structured data.
Return a JSON object with any of these fields you can identify (omit fields not mentioned):
- tag_number (string)
- name (string)
- sex (one of: bull, cow, heifer, steer, calf)
- breed (string)
- breed_percentage (number 0-100)
- dob (ISO date string YYYY-MM-DD)
- birth_weight_lbs (number)
- purchase_price (number)
- purchase_date (ISO date string)
- vendor (string)
- notes (string — anything that doesn't fit other fields)
Only return valid JSON, no explanation.`

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const audio = formData.get('audio')
  if (!audio || !(audio instanceof Blob)) {
    return NextResponse.json({ error: 'No audio provided' }, { status: 400 })
  }

  const file = new File([audio], 'recording.webm', { type: audio.type || 'audio/webm' })

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'en',
  })
  const transcript = transcription.text

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: PARSE_PROMPT },
      { role: 'user', content: transcript },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
  })

  let fields: Record<string, unknown> = {}
  try {
    fields = JSON.parse(completion.choices[0].message.content ?? '{}')
  } catch {
    // Return transcript without parsed fields if parsing fails
  }

  return NextResponse.json({ transcript, fields })
}
