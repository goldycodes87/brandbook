export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteFromR2 } from '@/lib/r2'

// GET /api/cron/purge-inbound — nightly.
//
// Emailed receipts are kept for one calendar year and then removed, files
// first. The DB rows cascade from inbound_emails, but R2 objects have no
// foreign key: deleting the rows first would orphan the files forever, so the
// files go first and the row is only dropped once they are gone.
//
// Expenses created from a receipt are NOT touched. They keep their
// receipt_url, which will 404 after the purge — the expense is accounting, the
// image was evidence with an agreed shelf life.
export async function GET(req: NextRequest) {
  // Vercel signs cron invocations with this header; without the secret set we
  // refuse rather than expose a public delete-by-GET.
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'not configured' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: expired, error } = await supabase
    .from('inbound_emails')
    .select('id, raw_key, inbound_receipts ( id, r2_key )')
    .lt('expires_on', today)
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const emails = (expired ?? []) as unknown as Array<{
    id: string; raw_key: string | null; inbound_receipts: Array<{ id: string; r2_key: string }>
  }>

  let filesDeleted = 0
  let emailsDeleted = 0
  const failures: string[] = []

  for (const email of emails) {
    const keys = [
      ...(email.raw_key ? [email.raw_key] : []),
      ...email.inbound_receipts.map(r => r.r2_key),
    ]

    let allGone = true
    for (const key of keys) {
      try { await deleteFromR2(key); filesDeleted++ }
      catch (e) {
        allGone = false
        failures.push(`${key}: ${e instanceof Error ? e.message : 'delete failed'}`)
      }
    }

    // Leave the row if a file survived — it will be retried tomorrow, and the
    // row is the only record of what still needs removing.
    if (!allGone) continue

    const { error: delErr } = await supabase.from('inbound_emails').delete().eq('id', email.id)
    if (delErr) failures.push(`${email.id}: ${delErr.message}`)
    else emailsDeleted++
  }

  return NextResponse.json({
    ok: failures.length === 0,
    examined: emails.length,
    emails_deleted: emailsDeleted,
    files_deleted: filesDeleted,
    failures,
  })
}
