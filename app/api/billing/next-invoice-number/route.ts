export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const sp      = req.nextUrl.searchParams
  const year    = Number(sp.get('year')    ?? new Date().getFullYear() % 100)
  const quarter = Number(sp.get('quarter') ?? Math.ceil((new Date().getMonth() + 1) / 3))

  const supabase = createAdminClient()

  // Count invoices for this year+quarter to derive sequence
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase as any)
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('invoice_quarter', quarter)
    .gte('created_at', `20${String(year).padStart(2, '0')}-01-01`)
    .lte('created_at', `20${String(year).padStart(2, '0')}-12-31`)

  const sequence     = (count ?? 0) + 1
  const yy           = String(year).padStart(2, '0')
  const qq           = String(quarter).padStart(2, '0')
  const seq          = String(sequence).padStart(3, '0')
  const invoiceNumber = `${yy}${qq}${seq}`

  return NextResponse.json({ invoice_number: invoiceNumber, sequence })
}
