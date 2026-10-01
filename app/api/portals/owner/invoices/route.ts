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
    .select('id, invoice_number, period_start, period_end, total_amount, status, due_date, pdf_url, created_at')
    .eq('owner_id', session.id)
    .in('status', ['sent', 'paid', 'approved'])
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}
