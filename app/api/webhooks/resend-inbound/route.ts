export const dynamic = 'force-dynamic'
// Downloading attachments and reading them with Claude takes longer than the
// default budget. Resend retries on failure and message_id makes ingest
// idempotent, so a timeout costs a retry rather than a receipt.
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadToR2 } from '@/lib/r2'
import { parseReceipt, isSupportedReceiptType } from '@/lib/receipt-parse'
import { matchReceiptLine, defaultDecision, type MatchCandidate } from '@/lib/receipt-matching'

/**
 * Who is allowed to create expenses by sending mail here.
 *
 * An address that turns email into accounting records is an injection target:
 * anyone who learns it could forge receipts, and the parser would believe
 * them. The allowlist is the gate, and the signature check above it is what
 * stops the allowlist being bypassed by forging the webhook itself.
 */
function allowedSenders(): string[] {
  return (process.env.RECEIPT_ALLOWED_SENDERS ?? '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
}

/** "Grant Goldberg <grant@example.com>" -> "grant@example.com" */
function emailAddress(from: string): string {
  const angled = from.match(/<([^>]+)>/)
  return (angled ? angled[1] : from).trim().toLowerCase()
}

function addYears(iso: string, years: number): string {
  const d = new Date(iso)
  d.setFullYear(d.getFullYear() + years)
  return d.toISOString().slice(0, 10)
}

async function download(url: string): Promise<{ body: Buffer; contentType: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download failed (${res.status})`)
  const buf = Buffer.from(await res.arrayBuffer())
  return { body: buf, contentType: res.headers.get('content-type') ?? 'application/octet-stream' }
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    console.error('[inbound] RESEND_WEBHOOK_SECRET is not set — refusing to trust the payload')
    return NextResponse.json({ error: 'not configured' }, { status: 500 })
  }

  // Raw body, before any parsing — the signature is over the exact bytes.
  const payload = await req.text()
  const resend  = new Resend(process.env.RESEND_API_KEY)

  // Resend wants the three Svix header values, not the Fetch Headers object.
  const svix = {
    id:        req.headers.get('svix-id') ?? '',
    timestamp: req.headers.get('svix-timestamp') ?? '',
    signature: req.headers.get('svix-signature') ?? '',
  }
  if (!svix.id || !svix.timestamp || !svix.signature) {
    return NextResponse.json({ error: 'missing signature headers' }, { status: 401 })
  }

  let event
  try {
    event = resend.webhooks.verify({ payload, headers: svix, webhookSecret: secret })
  } catch (e) {
    console.error('[inbound] signature verification failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  if (event.type !== 'email.received') {
    return NextResponse.json({ ok: true, ignored: event.type })
  }

  const data = event.data as {
    email_id: string; message_id: string; from: string; subject: string; created_at: string
  }

  const sender  = emailAddress(data.from)
  const allowed = allowedSenders()
  if (allowed.length === 0 || !allowed.includes(sender)) {
    // 200, not 403: the mail arrived and was rejected on purpose. A non-2xx
    // would make Resend retry a message we will never accept.
    console.warn('[inbound] rejected sender:', sender)
    return NextResponse.json({ ok: true, rejected: 'sender not allowed' })
  }

  const supabase = createAdminClient()

  // message_id is unique, so a retried webhook lands here and stops.
  const { data: emailRow, error: insertErr } = await supabase
    .from('inbound_emails')
    .insert({
      message_id:   data.message_id,
      from_address: sender,
      subject:      data.subject ?? null,
      received_at:  data.created_at,
      status:       'pending',
      expires_on:   addYears(data.created_at, 1),
    })
    .select('id')
    .single()

  if (insertErr) {
    if (insertErr.code === '23505') return NextResponse.json({ ok: true, duplicate: true })
    console.error('[inbound] could not record email:', insertErr.message)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  const emailId = (emailRow as { id: string }).id

  try {
    const full = await resend.emails.receiving.get(data.email_id)
    if (full.error || !full.data) throw new Error(full.error?.message ?? 'could not fetch the email')

    // The original .eml — the copy that answers "prove this came from a real
    // receipt" long after the parsed numbers have been edited.
    if (full.data.raw?.download_url) {
      const raw = await download(full.data.raw.download_url)
      const key = `inbound-emails/${emailId}/original.eml`
      await uploadToR2(key, raw.body, 'message/rfc822')
      await supabase.from('inbound_emails').update({ raw_key: key }).eq('id', emailId)
    }

    let receiptsIngested = 0

    for (const att of full.data.attachments ?? []) {
      if (!isSupportedReceiptType(att.content_type)) continue

      const signed = await resend.emails.receiving.attachments.get({
        emailId: data.email_id,
        id:      att.id,
      })
      if (signed.error || !signed.data?.download_url) {
        console.error('[inbound] no download url for attachment', att.id)
        continue
      }

      const file = await download(signed.data.download_url)
      const key  = `inbound-receipts/${emailId}/${att.id}-${att.filename ?? 'receipt'}`
      await uploadToR2(key, file.body, att.content_type)

      const { data: receiptRow } = await supabase
        .from('inbound_receipts')
        .insert({
          email_id:     emailId,
          r2_key:       key,
          filename:     att.filename,
          content_type: att.content_type,
          size_bytes:   att.size ?? null,
          parse_status: 'pending',
        })
        .select('id')
        .single()

      const receiptId = (receiptRow as { id: string } | null)?.id
      if (!receiptId) continue
      receiptsIngested++

      // Parsing is the step most likely to fail, and it fails per receipt.
      // The file is already stored, so a failure here is recoverable from the
      // queue rather than lost.
      try {
        const parsed = await parseReceipt(file.body, att.content_type)

        await supabase.from('inbound_receipts').update({
          vendor:        parsed.vendor,
          receipt_date:  parsed.date,
          receipt_total: parsed.total,
          parse_status:  'parsed',
        }).eq('id', receiptId)

        await insertLineItems(supabase, receiptId, parsed)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'parse failed'
        console.error('[inbound] parse failed for', receiptId, msg)
        await supabase.from('inbound_receipts')
          .update({ parse_status: 'failed', parse_error: msg })
          .eq('id', receiptId)
      }
    }

    await supabase.from('inbound_emails')
      .update({ status: receiptsIngested > 0 ? 'processed' : 'failed',
                error:  receiptsIngested > 0 ? null : 'no readable receipt attached' })
      .eq('id', emailId)

    return NextResponse.json({ ok: true, receipts: receiptsIngested })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'ingest failed'
    console.error('[inbound] ingest failed:', msg)
    await supabase.from('inbound_emails').update({ status: 'failed', error: msg }).eq('id', emailId)
    // 500 so Resend retries; the unique message_id keeps the retry from
    // duplicating anything already written.
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

type DB = ReturnType<typeof createAdminClient>

/**
 * Turn parsed lines into review rows, each already matched against what is
 * on the books.
 */
async function insertLineItems(
  supabase: DB,
  receiptId: string,
  parsed: Awaited<ReturnType<typeof parseReceipt>>,
) {
  const { data: cats } = await supabase.from('expense_categories').select('id, name')
  const catByName = new Map(
    ((cats ?? []) as Array<{ id: string; name: string }>).map(c => [c.name, c.id]),
  )

  const candidates = await loadCandidates(supabase, parsed.date)

  const rows = parsed.items.map((item, i) => {
    const match = matchReceiptLine(
      { amount: item.amount, date: parsed.date, description: item.description, vendor: parsed.vendor },
      candidates,
    )
    return {
      receipt_id:              receiptId,
      line_no:                 i,
      description:             item.description,
      amount:                  item.amount,
      suggested_category_name: item.suggested_category,
      suggested_category_id:   item.suggested_category ? catByName.get(item.suggested_category) ?? null : null,
      matched_expense_id:      match.candidate?.id ?? null,
      matched_split_group_id:  match.candidate?.split_group_id ?? null,
      match_score:             match.score,
      match_reason:            match.reason,
      // A line the parser could not categorise is not a ranch expense — dog
      // food on a feed-store receipt. Default it to skip so approving the
      // receipt does not quietly book it.
      decision:                item.suggested_category === null ? 'skip' : defaultDecision(match),
    }
  })

  if (rows.length > 0) await supabase.from('receipt_line_items').insert(rows)
}

/**
 * Expenses worth comparing against: a window around the receipt date, with
 * split rows collapsed to their group total.
 */
async function loadCandidates(supabase: DB, receiptDate: string | null): Promise<MatchCandidate[]> {
  const anchor = receiptDate ? new Date(receiptDate + 'T00:00:00') : new Date()
  const from = new Date(anchor); from.setDate(from.getDate() - 30)
  const to   = new Date(anchor); to.setDate(to.getDate() + 30)

  const { data } = await supabase
    .from('lease_expenses')
    .select('id, split_group_id, total_amount, expense_date, period_start, description, category_name, vendor, receipt_url')
    .gte('expense_date', from.toISOString().slice(0, 10))
    .lte('expense_date', to.toISOString().slice(0, 10))

  const rows = (data ?? []) as unknown as Array<{
    id: string; split_group_id: string | null; total_amount: number
    expense_date: string | null; period_start: string | null
    description: string | null; category_name: string | null
    vendor: string | null; receipt_url: string | null
  }>

  // Collapse each split to one candidate carrying the whole expense. Twelve
  // $175 rows are one $2,100 purchase, and only the total can ever match a
  // receipt.
  const groups = new Map<string, MatchCandidate>()
  const singles: MatchCandidate[] = []

  for (const r of rows) {
    const base: MatchCandidate = {
      id: r.id,
      split_group_id: r.split_group_id,
      amount: Number(r.total_amount) || 0,
      date: r.expense_date ?? r.period_start,
      description: r.description,
      category_name: r.category_name,
      vendor: r.vendor,
      has_receipt: Boolean(r.receipt_url),
    }

    if (!r.split_group_id) { singles.push(base); continue }

    const existing = groups.get(r.split_group_id)
    if (existing) {
      existing.amount += base.amount
      existing.has_receipt = existing.has_receipt || base.has_receipt
    } else {
      groups.set(r.split_group_id, { ...base })
    }
  }

  return [...singles, ...groups.values()]
}
