export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  if (!process.env.SQUARE_ACCESS_TOKEN || !process.env.SQUARE_LOCATION_ID) {
    return NextResponse.json({ error: 'Square not configured' }, { status: 501 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invoice, error } = await (supabase as any)
    .from('invoices')
    .select('*, owner:grazing_owners(id, name, company_name, owner_name)')
    .eq('id', id)
    .single()

  if (error || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { SquareClient, SquareEnvironment } = require('square') as {
    SquareClient: new (opts: { token: string; environment: string }) => {
      checkout: {
        paymentLinks: {
          create: (body: unknown) => Promise<{ paymentLink?: { url?: string } }>
        }
      }
    }
    SquareEnvironment: { Production: string; Sandbox: string }
  }

  const client = new SquareClient({
    token:       process.env.SQUARE_ACCESS_TOKEN,
    environment: process.env.SQUARE_ENVIRONMENT === 'production'
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox,
  })

  const ownerLabel  = invoice.owner?.company_name || invoice.owner?.owner_name || invoice.owner?.name || 'Owner'
  const amountCents = BigInt(Math.round((invoice.total_amount ?? 0) * 100))

  const result = await client.checkout.paymentLinks.create({
    idempotencyKey: `inv-${id}-${Date.now()}`,
    quickPay: {
      name:        `Invoice ${invoice.invoice_number} — ${ownerLabel}`,
      priceMoney:  { amount: amountCents, currency: 'USD' },
      locationId:  process.env.SQUARE_LOCATION_ID,
    },
  })

  const linkUrl = result.paymentLink?.url
  if (!linkUrl) return NextResponse.json({ error: 'Failed to create Square payment link' }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('invoices').update({ square_payment_link: linkUrl }).eq('id', id)

  return NextResponse.json({ payment_link_url: linkUrl })
}
