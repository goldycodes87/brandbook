export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOwnerSession } from '@/lib/owner-auth'

export async function GET() {
  const session = await getOwnerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('owner_requests')
    .select('id, request_type, status, quantity, animal_type, budget_min, budget_max, breed, timeframe, animal_id, sell_reason, sell_timeline, funds_disposition, funds_other_notes, notes, rancher_notes, created_at')
    .eq('owner_id', session.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await getOwnerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const { request_type } = body
  if (!['buy', 'sell'].includes(request_type)) {
    return NextResponse.json({ error: 'request_type must be buy or sell' }, { status: 400 })
  }

  if (request_type === 'buy') {
    if (!body.quantity || !body.animal_type || !body.timeframe) {
      return NextResponse.json({ error: 'quantity, animal_type, and timeframe are required for buy requests' }, { status: 400 })
    }
  }

  if (request_type === 'sell') {
    if (!body.animal_id || !body.sell_reason || !body.sell_timeline || !body.funds_disposition) {
      return NextResponse.json({ error: 'animal_id, sell_reason, sell_timeline, and funds_disposition are required for sell requests' }, { status: 400 })
    }
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('owner_requests')
    .insert({
      owner_id: session.id,
      request_type,
      status: 'pending',
      quantity: body.quantity ?? null,
      animal_type: body.animal_type ?? null,
      budget_min: body.budget_min ?? null,
      budget_max: body.budget_max ?? null,
      breed: body.breed ?? null,
      timeframe: body.timeframe ?? null,
      animal_id: body.animal_id ?? null,
      sell_reason: body.sell_reason ?? null,
      sell_timeline: body.sell_timeline ?? null,
      funds_disposition: body.funds_disposition ?? null,
      funds_other_notes: body.funds_other_notes ?? null,
      notes: body.notes ?? null,
    })
    .select('id, request_type, status, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
