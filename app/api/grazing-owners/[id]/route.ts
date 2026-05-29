export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('grazing_owners')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const body = await req.json()

  const clean: Record<string, unknown> = {}
  const allowed = ['name', 'company_name', 'owner_name', 'email', 'phone', 'address', 'city', 'state', 'zip', 'billing_address', 'billing_rate', 'billing_type', 'brand_photo_url', 'brand_drawing_url', 'default_breed', 'default_ear_tag_color', 'default_tag_prefix', 'notes']
  for (const k of allowed) {
    if (k in body) clean[k] = body[k] === '' ? null : body[k]
  }
  if (clean.billing_rate != null) clean.billing_rate = Number(clean.billing_rate)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data, error } = await (supabase as any)
    .from('grazing_owners')
    .update(clean)
    .eq('id', id)
    .select()
    .single()

  // Retry without new columns if migration hasn't run yet
  if (error?.code === '42703') {
    delete clean.company_name; delete clean.owner_name; delete clean.brand_drawing_url
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;({ data, error } = await (supabase as any)
      .from('grazing_owners').update(clean).eq('id', id).select().single())
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { count } = await supabase
    .from('animals')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', id)

  if (count && count > 0) {
    return NextResponse.json(
      { error: `Cannot delete owner with ${count} assigned animal${count !== 1 ? 's' : ''}. Reassign animals first.` },
      { status: 400 }
    )
  }

  const { error } = await supabase.from('grazing_owners').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
