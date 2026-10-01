export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOwnerSession } from '@/lib/owner-auth'
import { generateInvoicePdfBuffer } from '@/lib/generate-invoice-pdf'

/**
 * An owner's own invoice, as a PDF, built on request.
 *
 * The portal used to offer a download only when invoices.pdf_url happened to
 * be set, and the send path never set it — so an owner who lost the email
 * could see that an invoice existed and for how much, and could not open it.
 * Storing a copy at send time fixes that going forward and does nothing for
 * the ones already out.
 *
 * Generating on request fixes all of them and removes the dependency
 * altogether: there is no stored file to go missing, and the PDF is always
 * built from the invoice as it stands rather than from whatever it looked like
 * the day it was filed.
 *
 * Drafts and voids are refused for the same reason they are hidden from the
 * list: a draft is a bill the ranch has not agreed to send, and a void is one
 * it took back.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOwnerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('invoices')
    .select('id, owner_id, status, invoice_number')
    .eq('id', id)
    .maybeSingle()

  const invoice = data as {
    id: string; owner_id: string; status: string | null; invoice_number: string | null
  } | null

  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Scoped to the signed-in owner, never to the id in the URL. Otherwise one
  // owner could read another man's billing by changing a digit.
  if (invoice.owner_id !== session.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!['sent', 'paid', 'approved'].includes(invoice.status ?? '')) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  try {
    const pdf = await generateInvoicePdfBuffer(invoice.id)
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Invoice-${invoice.invoice_number ?? invoice.id}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
