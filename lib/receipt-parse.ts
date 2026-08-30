// Reading a receipt with Claude.
//
// Extracted from app/api/ai/parse-expense so the inbound-email pipeline can
// call it directly. An internal HTTP hop would have to carry a session cookie
// it does not have — the same trap that broke calving→reproduction and
// billing/send→square-link.
//
// Model: claude-sonnet-4-6, matching the phone-scan path. The same receipt
// photographed at the feed store and forwarded by email has to come back with
// the same vendor, date and line items, and that is only guaranteed if both
// paths ask the same model the same question.

import Anthropic from '@anthropic-ai/sdk'

export interface ParsedReceiptItem {
  description: string
  amount: number
  suggested_category: string | null
}

export interface ParsedReceipt {
  vendor: string | null
  date: string | null
  items: ParsedReceiptItem[]
  total: number | null
}

/** Images Claude can read directly. */
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
type ImageType = typeof IMAGE_TYPES[number]

export function isSupportedReceiptType(contentType: string | null | undefined): boolean {
  const t = (contentType ?? '').toLowerCase().split(';')[0].trim()
  return t === 'application/pdf' || (IMAGE_TYPES as readonly string[]).includes(t)
}

const CATEGORY_LIST = [
  'Hay / Forage', 'Protein / Mineral Tubs', 'Salt / Loose Mineral',
  'Pasture Treatment', 'Working Animals', 'Fence Repair',
  'Equipment Rental', 'Labor', 'Water / Utilities', 'Other (Shared)',
  'AI Technician Fee', 'Semen Straws', 'Preg Check', 'Other (Owner Specific)',
  'Vet Bill', 'Medication', 'Veterinary Procedure', 'Other (Animal Specific)',
]

// Every line is kept, including the ones that are not ranch expenses. A bag of
// dog food on a feed-store receipt is decided in the review queue, not
// silently dropped here — a parser that hides lines makes the total stop
// adding up and there is no way to tell from the queue that it happened.
const PROMPT = `You are reading a receipt for a cattle ranch.

Extract EVERY line item, including any that are clearly personal rather than
ranch expenses (pet food, groceries, household goods). Do not omit or merge
lines. The operator decides what to record.

Respond ONLY with valid JSON, no other text, no markdown:
{
  "vendor": "store name, or null",
  "date": "YYYY-MM-DD, or null",
  "items": [
    {
      "description": "item name as printed",
      "amount": 0.00,
      "suggested_category": "best fit from the list below, or null if it is not a ranch expense"
    }
  ],
  "total": 0.00
}

Categories: ${CATEGORY_LIST.join(' | ')}

Rules:
- amount is the extended line total, not the unit price.
- Tax, shipping and fees are their own line items.
- suggested_category MUST be null for anything that is not a ranch expense.
- If the receipt is unreadable, return {"vendor":null,"date":null,"items":[],"total":null}.`

function extractJson(text: string): ParsedReceipt {
  // The model is asked for bare JSON, but a stray fence or preamble should not
  // lose a receipt the operator already forwarded.
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON in model response')

  const raw = JSON.parse(match[0]) as Partial<ParsedReceipt>
  const num = (v: unknown): number | null => {
    const n = typeof v === 'string' ? Number(v.replace(/[^0-9.-]/g, '')) : Number(v)
    return Number.isFinite(n) ? n : null
  }

  return {
    vendor: typeof raw.vendor === 'string' && raw.vendor.trim() ? raw.vendor.trim() : null,
    date:   typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : null,
    total:  num(raw.total),
    items: (Array.isArray(raw.items) ? raw.items : []).flatMap(i => {
      const amount = num((i as ParsedReceiptItem)?.amount)
      const description = (i as ParsedReceiptItem)?.description
      if (amount === null || typeof description !== 'string') return []
      const cat = (i as ParsedReceiptItem)?.suggested_category
      return [{
        description: description.trim(),
        amount,
        suggested_category: typeof cat === 'string' && CATEGORY_LIST.includes(cat) ? cat : null,
      }]
    }),
  }
}

/**
 * Parse a receipt file.
 *
 * PDFs go up as a `document` block and images as an `image` block — a PDF sent
 * as an image is rejected by the API, and emailed receipts are very often
 * PDFs, which the original photo-only path could not read at all.
 */
export async function parseReceipt(
  file: Buffer | Uint8Array,
  contentType: string,
): Promise<ParsedReceipt> {
  const type = contentType.toLowerCase().split(';')[0].trim()
  if (!isSupportedReceiptType(type)) {
    throw new Error(`Unsupported receipt type: ${contentType}`)
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const data = Buffer.from(file).toString('base64')

  const source = type === 'application/pdf'
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: type as ImageType, data } }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      // Document/image first, then the instruction — the documented ordering
      // for both block types.
      content: [source, { type: 'text', text: PROMPT }],
    }],
  })

  const text = message.content.find(b => b.type === 'text')
  if (!text || text.type !== 'text') throw new Error('No text in model response')
  return extractJson(text.text)
}
