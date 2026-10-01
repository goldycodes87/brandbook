export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifySale } from '@/lib/notify-transactions'
import { describeAnimal } from '@/lib/animal-label'
import type { SaleLine, AppliedFee } from '@/lib/sale-fees'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body     = await req.json()
  const supabase = createAdminClient()

  // Fetch current animal state for snapshot
  const { data: animal } = await supabase
    .from('animals')
    .select('id, owner_id, origin')
    .eq('id', id)
    .single()

  if (!animal) return NextResponse.json({ error: 'Animal not found' }, { status: 404 })

  const {
    sale_date       = new Date().toISOString().slice(0, 10),
    buyer           = null,
    destination     = null,
    sale_weight_lbs = null,
    price_per_lb    = null,
    gross_proceeds  = null,
    notes           = null,
    buyer_type      = 'external',  // 'external' | 'internal'
    buyer_owner_id  = null,
  } = body

  // Insert sales row with seller snapshot
  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .insert({
      animal_id:       id,
      sale_date,
      buyer:           buyer    || null,
      destination:     destination || null,
      sale_weight_lbs: sale_weight_lbs ? Number(sale_weight_lbs) : null,
      price_per_lb:    price_per_lb    ? Number(price_per_lb)    : null,
      gross_proceeds:  gross_proceeds  ? Number(gross_proceeds)  : null,
      notes:           notes    || null,
      owner_id:        animal.owner_id,           // seller snapshot
      origin:          animal.origin  || null,    // origin snapshot
      buyer_owner_id:  buyer_owner_id || null,
    })
    .select()
    .single()

  if (saleErr) return NextResponse.json({ error: saleErr.message }, { status: 500 })

  if (buyer_type === 'internal' && buyer_owner_id) {
    // Internal transfer-sale — keep active, reassign owner
    const { error: updateErr } = await supabase
      .from('animals')
      .update({
        owner_id:      buyer_owner_id,
        purchase_price: gross_proceeds ? Number(gross_proceeds) : null,
        purchase_date:  sale_date,
        origin:        'purchased',
      })
      .eq('id', id)
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
  } else {
    // External sale — remove from active herd
    const { error: updateErr } = await supabase
      .from('animals')
      .update({
        status:           'sold',
        disposition:      'sold',
        disposition_date: sale_date,
        disposition_notes: notes || null,
      })
      .eq('id', id)
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    // Take him off the pasture as of the sale.
    //
    // Marking the animal sold was not enough: shared expenses are pro-rated by
    // grazing_assignments, not by animals.status, so an assignment left open
    // kept accruing animal-days for an animal that was gone -- overcharging
    // his owner and undercharging everyone else for the rest of the quarter.
    const { error: grazeErr } = await supabase
      .from('grazing_assignments')
      .update({ end_date: sale_date })
      .eq('animal_id', id)
      .is('end_date', null)
    if (grazeErr) {
      console.error('[animals/sell] failed to close grazing assignment:', grazeErr.message)
    }
  }

  // ── Tell the seller what he cleared ─────────────────────────────────────────
  //
  // The fees come from the caller, because which ones apply is a decision about
  // THIS sale: cattle that never left the place owe no hauling and no
  // commission. Nothing is assumed — an unticked checklist sends a statement
  // with no fees on it, which is correct for a private deal between two owners
  // on the same lease.
  //
  // Cannot fail the sale. The animal is sold and the row is written whether or
  // not Resend answered.
  let notified: unknown = null
  try {
    if (animal.owner_id) {
      const { data: a } = await supabase
        .from('animals')
        .select('tag_number, name, sex, breed, ear_tag_color, pair_animal_id, purchased_as_pair')
        .eq('id', id)
        .maybeSingle()

      const row = a as {
        tag_number: string | null; name: string | null; sex: string | null
        breed: string | null; ear_tag_color: string | null
        pair_animal_id: string | null; purchased_as_pair: boolean | null
      } | null

      let pairTag: string | null = null
      if (row?.purchased_as_pair && row.pair_animal_id) {
        const { data: p } = await supabase
          .from('animals').select('tag_number').eq('id', row.pair_animal_id).maybeSingle()
        pairTag = (p as { tag_number: string | null } | null)?.tag_number ?? null
      }

      const label = describeAnimal({
        sex: row?.sex, breed: row?.breed, ear_tag_color: row?.ear_tag_color,
        tag_number: row?.tag_number, name: row?.name,
        isPair: Boolean(pairTag), pairTag,
      })

      // Weight and a price per pound mean she went on weight; otherwise the
      // figure agreed is the figure, and she went by the head.
      const byWeight = sale_weight_lbs != null && price_per_lb != null
      const line: SaleLine = {
        what: label.title,
        tag:  label.tagLine,
        date: sale_date,
        basis: byWeight ? 'pound' : 'head',
        head: pairTag ? 2 : 1,
        weightLbs:    byWeight ? Number(sale_weight_lbs) : null,
        pricePerLb:   byWeight ? Number(price_per_lb)    : null,
        pricePerHead: byWeight ? null : (gross_proceeds ? Number(gross_proceeds) : 0),
      }

      notified = await notifySale({
        ownerId:   animal.owner_id,
        buyerName: buyer || destination || 'a buyer',
        lines:     [line],
        fees:      Array.isArray(body.fees) ? (body.fees as AppliedFee[]) : [],
        saleId:    sale?.id ?? null,
      })
    }
  } catch (e) {
    console.error('[animals/sell] notify failed:', (e as Error).message)
  }

  return NextResponse.json({ ok: true, sale, notified }, { status: 201 })
}
