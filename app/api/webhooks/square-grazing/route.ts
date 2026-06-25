export const dynamic = 'force-dynamic'

import { createHmac } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const body = await req.text()
  const sig  = req.headers.get('x-square-hmacsha256-signature')

  const webhookSecret = process.env.SQUARE_GRAZING_WEBHOOK_SECRET
  if (webhookSecret && sig) {
    const webhookUrl = process.env.SQUARE_GRAZING_WEBHOOK_URL || ''
    const hmac = createHmac('sha256', webhookSecret)
    hmac.update(webhookUrl + body)
    const expected = hmac.digest('base64')
    if (sig !== expected) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  let event: Record<string, unknown>
  try {
    event = JSON.parse(body)
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (event.type === 'payment.completed') {
    const payment    = (event.data as Record<string, unknown>)?.object as Record<string, unknown> | undefined
    const paymentObj = payment?.payment as Record<string, unknown> | undefined
    const totalMoney = paymentObj?.total_money as Record<string, unknown> | undefined
    const amountPaid = totalMoney?.amount ? Number(totalMoney.amount) / 100 : 0

    if (amountPaid > 0) {
      const supabase = createAdminClient()

      // Back out the 3% surcharge to find the base invoice amount
      const baseAmount = Math.round(amountPaid / 1.03 * 100) / 100

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: invoices } = await (supabase as any)
        .from('invoices')
        .select('id, total_amount')
        .eq('status', 'sent')
        .gte('total_amount', baseAmount - 1)
        .lte('total_amount', baseAmount + 1)

      if (invoices?.length === 1) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('invoices')
          .update({
            status:         'paid',
            paid_at:        new Date().toISOString(),
            paid_amount:    amountPaid,
            payment_method: 'card',
          })
          .eq('id', invoices[0].id)
      }
    }
  }

  return Response.json({ ok: true })
}
