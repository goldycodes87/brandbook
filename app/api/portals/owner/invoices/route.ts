export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOwnerSession } from '@/lib/owner-auth'

export async function GET() {
  const session = await getOwnerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  // Issued invoices only.
  //
  // This had no status filter, so an owner saw every row the table held. A
  // DRAFT is a bill the ranch is still working on and has not agreed to send;
  // a VOID is one it took back. Both were being shown, and the portal counts
  // anything not 'paid' as outstanding -- so when invoice 2604002 was voided
  // and redrafted at a higher figure, Doug's home screen was a refresh away
  // from reading OUTSTANDING $2,559.30 for a single $1,429.65 quarter, with a
  // draft nobody had approved sitting on it.
  //
  // An owner sees a bill when it is sent. Not before, and not after it is
  // withdrawn.
  const { data, error } = await supabase
    .from('invoices')
    // viewed_at comes back so the stamp below can tell a first sighting from
    // a return visit without a second query.
    .select('id, invoice_number, period_start, period_end, total_amount, status, due_date, pdf_url, created_at, viewed_at')
    .eq('owner_id', session.id)
    .in('status', ['sent', 'paid', 'approved'])
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Stamp the ones he is seeing for the first time.
  //
  // invoices.viewed_at has existed since the beginning and nothing ever wrote
  // to it. The billing screen shows a "Viewed" row in its timeline that could
  // never fill in, and an empty column could not tell "he has not looked" from
  // "we never recorded it" — so it answered nothing and looked like it should.
  //
  // First sighting only: it records when the bill reached him, which is the
  // useful fact when a payment is late. Re-stamping on every visit would turn
  // it into a second last_seen_at and lose that.
  //
  // Not awaited. Nobody's invoice list should fail to load over this.
  const unseen = (data ?? [])
    .filter((i: { viewed_at: string | null }) => !i.viewed_at)
    .map((i: { id: string }) => i.id)

  if (unseen.length > 0) {
    void supabase
      .from('invoices')
      .update({ viewed_at: new Date().toISOString() })
      .in('id', unseen)
      .then(({ error: e }) => { if (e) console.error('[invoice viewed_at]', e.message) })
  }

  return NextResponse.json({ data: data ?? [] })
}
