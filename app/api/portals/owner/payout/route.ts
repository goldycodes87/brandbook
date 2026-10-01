export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOwnerSession } from '@/lib/owner-auth'

/**
 * What the owner wants done with the money from a sale.
 *
 * Recorded as an owner_request so it lands on the Requests screen the ranch
 * already watches every day, next to the buy and sell requests. A separate
 * table would have meant a separate screen, and a separate screen is one
 * nobody opens.
 *
 * This records an instruction. It moves no money and settles no invoice —
 * Grant does that, having read it.
 */

const CHOICES: Record<string, { disposition: string; note: string }> = {
  check:   { disposition: 'check',             note: 'Mail a check for the proceeds.' },
  buy:     { disposition: 'keep_for_purchase', note: 'Hold the proceeds on account to buy more cattle.' },
  invoice: { disposition: 'invoice_first',     note: 'Settle the open invoice out of the proceeds, then send the balance.' },
}

export async function POST(req: NextRequest) {
  const session = await getOwnerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { choice?: string; sale_id?: string; notes?: string }
  const choice = CHOICES[body.choice ?? '']
  if (!choice) return NextResponse.json({ error: 'Pick one of: check, buy, invoice' }, { status: 400 })

  const supabase = createAdminClient()

  // A sale id is accepted but never trusted: it arrives from a link in an
  // email, and an owner must not be able to attach an instruction to somebody
  // else's sale by changing it.
  let saleId: string | null = null
  if (body.sale_id) {
    const { data: sale } = await supabase
      .from('sales')
      .select('id, owner_id, animal_id')
      .eq('id', body.sale_id)
      .maybeSingle()

    const s = sale as { id: string; owner_id: string | null; animal_id: string } | null
    if (s) {
      if (s.owner_id && s.owner_id !== session.id) {
        return NextResponse.json({ error: 'That sale is not yours' }, { status: 403 })
      }
      if (!s.owner_id) {
        // Older rows carry no owner snapshot, so fall back to the animal.
        const { data: animal } = await supabase
          .from('animals').select('owner_id').eq('id', s.animal_id).maybeSingle()
        if ((animal as { owner_id: string | null } | null)?.owner_id !== session.id) {
          return NextResponse.json({ error: 'That sale is not yours' }, { status: 403 })
        }
      }
      saleId = s.id
    }
  }

  // One live instruction per sale. Pressing a different button in the same
  // email should change the answer, not queue a second one that contradicts
  // the first.
  if (saleId) {
    await supabase
      .from('owner_requests')
      .delete()
      .eq('owner_id', session.id)
      .eq('sale_id', saleId)
      .eq('request_type', 'payout')
      .eq('status', 'pending')
  }

  const { data, error } = await supabase
    .from('owner_requests')
    .insert({
      owner_id:          session.id,
      request_type:      'payout',
      status:            'pending',
      funds_disposition: choice.disposition,
      sale_id:           saleId,
      notes:             (body.notes ?? '').trim() || choice.note,
    })
    .select('id, funds_disposition, sale_id, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
