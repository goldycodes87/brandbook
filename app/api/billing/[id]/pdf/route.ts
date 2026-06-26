export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadToR2 } from '@/lib/r2'
import { generateInvoicePdfBuffer } from '@/lib/generate-invoice-pdf'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invoice, error } = await (supabase as any)
    .from('invoices').select('invoice_number').eq('id', id).single()
  if (error || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  try {
    const pdfBuffer = await generateInvoicePdfBuffer(id)

    const pdfKey = `invoices/${invoice.invoice_number}.pdf`
    const pdfUrl = await uploadToR2(pdfKey, pdfBuffer, 'application/pdf')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('invoices').update({ pdf_url: pdfUrl }).eq('id', id)

    return NextResponse.json({ pdf_url: pdfUrl })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('[PDF error]', error.message, error.stack)
    return NextResponse.json({ error: 'PDF generation failed', details: error.message }, { status: 500 })
  }
}
