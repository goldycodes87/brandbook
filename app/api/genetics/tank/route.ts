export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('semen_inventory')
    .select(`
      *,
      sire_library:sire_library_id (
        id, bull_name, breed, epd_ced, epd_bw, epd_ww, epd_yw, epd_marbling, naab_code
      )
    `)
    .order('sire_name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const { id, straw_count, delta } = await req.json()

  // Relative adjustment via the adjust_straw RPC — atomic, so concurrent
  // sessions cannot clobber each other's count. Used when returning a straw
  // on undo. Absolute straw_count remains supported for manual corrections.
  if (delta !== undefined) {
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const supabase = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('adjust_straw', {
      p_inventory_id: id,
      p_delta:        Number(delta),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: { id, straw_count: data } })
  }

  if (!id || straw_count === undefined) {
    return NextResponse.json({ error: 'id and straw_count required' }, { status: 400 })
  }
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('semen_inventory')
    .update({ straw_count: Number(straw_count) })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// ── Shared upsert logic ────────────────────────────────────────────────────────

interface StrawEntry {
  sire_library_id?: string | null
  sire_name?: string | null
  tank_name?: string | null
  canister?: string | null
  cane?: string | null
  straw_count?: number
  price_per_straw?: number | null
  straw_size?: string | null
  is_sexed?: boolean
  purchase_date?: string | null
  notes?: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertStraw(supabase: any, entry: StrawEntry): Promise<{ data: unknown; isNew: boolean }> {
  const {
    sire_library_id, sire_name, tank_name, canister, cane,
    straw_count, price_per_straw, straw_size, is_sexed,
    purchase_date, notes,
  } = entry

  // If we have a sire_library_id, check for an existing inventory row and add to it
  if (sire_library_id) {
    const { data: existing } = await supabase
      .from('semen_inventory')
      .select('id, straw_count')
      .eq('sire_library_id', sire_library_id)
      .maybeSingle()

    if (existing) {
      const updates: Record<string, unknown> = {
        straw_count: (existing.straw_count ?? 0) + Number(straw_count ?? 0),
      }
      if (price_per_straw != null) updates.price_per_straw = Number(price_per_straw)
      const { data, error } = await supabase
        .from('semen_inventory')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return { data, isNew: false }
    }
  }

  // New row — resolve sire_name from library if not provided
  let resolvedSireName = sire_name
  if (sire_library_id && !sire_name) {
    const { data: sl } = await supabase.from('sire_library').select('bull_name').eq('id', sire_library_id).single()
    resolvedSireName = sl?.bull_name ?? 'Unknown'
  }

  const { data, error } = await supabase
    .from('semen_inventory')
    .insert({
      sire_library_id:  sire_library_id || null,
      sire_name:        resolvedSireName,
      tank_name:        tank_name || 'Legacy Tank',
      canister:         canister || null,
      cane:             cane || null,
      straw_count:      Number(straw_count ?? 0),
      price_per_straw:  price_per_straw != null ? Number(price_per_straw) : null,
      straw_size:       straw_size || '0.5cc',
      is_sexed:         Boolean(is_sexed),
      purchase_date:    purchase_date || null,
      notes:            notes || null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return { data, isNew: true }
}

// ── POST — single object OR array ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = createAdminClient()

  // Batch mode: accept an array of straw-purchase objects
  if (Array.isArray(body)) {
    const results: unknown[] = []
    for (const entry of body) {
      if (!entry.sire_library_id && !entry.sire_name) {
        return NextResponse.json({ error: 'Each entry requires sire_library_id or sire_name' }, { status: 400 })
      }
      try {
        const { data } = await upsertStraw(supabase, entry)
        results.push(data)
      } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 500 })
      }
    }
    return NextResponse.json({ data: results })
  }

  // Single-object mode: original behavior, return codes preserved
  if (!body.sire_library_id && !body.sire_name) {
    return NextResponse.json({ error: 'sire_library_id or sire_name required' }, { status: 400 })
  }

  try {
    const { data, isNew } = await upsertStraw(supabase, body)
    return NextResponse.json({ data }, isNew ? { status: 201 } : undefined)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
