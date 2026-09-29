export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOwnerSession } from '@/lib/owner-auth'
import { resolvePeriod, withinPeriod, type PeriodKey } from '@/lib/purchase-periods'

/**
 * What THIS owner bought: when, what, from whom, for how much.
 *
 * ── The thing this gets right that the first version did not ──────────────
 *
 * A purchase belongs to an OWNER, not to an animal. An animal changes hands
 * and each owner has their own purchase of it — their own date, their own
 * seller, their own price. animals.purchase_price / purchase_date / vendor
 * hold exactly one of those, whichever was typed in first, and it belongs to
 * whoever owned the animal then.
 *
 * So Doug's report was showing him that he bought Daphne from Ben Perez for
 * $2,000 and Lola from Gnoll Ranch. He bought neither. He bought both from
 * Andy Holloman on 30 September. Ben Perez and Gnoll Ranch are Andy's
 * history, and they belong on the ranch's side of the app, not on Doug's.
 *
 * The ownership chain is in calf_transfers — from, to, date, price — and that
 * is what an owner's purchase actually is. So:
 *
 *   1. Every transfer TO this owner is a purchase: seller, date and price
 *      come from the transfer.
 *   2. An animal with purchase fields and NO transfer to this owner is one
 *      they bought from outside themselves — an auction, a neighbour — and
 *      those fields are theirs.
 *
 * Anything else on the animal is a previous owner's business.
 *
 * ── Pairs ─────────────────────────────────────────────────────────────────
 * One transaction, one date, and the price on the cow. The calf carries no
 * price of its own; showing it separately either doubles the money or claims
 * a calf was free.
 */

interface PurchaseRow {
  animal_ids: string[]
  date: string | null
  description: string
  tag: string
  cost: number | null
  seller: string | null
  source: 'transfer' | 'outside'
}

export async function GET(req: NextRequest) {
  const session = await getOwnerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const period = resolvePeriod((req.nextUrl.searchParams.get('period') ?? 'all_time') as PeriodKey)

  const supabase = createAdminClient()

  const [animalsRes, transfersRes] = await Promise.all([
    supabase
      .from('animals')
      .select('id, tag_number, name, sex, breed, ear_tag_color, purchase_date, purchase_price, vendor, origin, purchased_as_pair, pair_animal_id')
      .eq('owner_id', session.id)
      .order('tag_number', { ascending: true }),
    supabase
      .from('calf_transfers')
      .select('animal_id, from_owner_id, transfer_date, fmv_at_transfer')
      .eq('to_owner_id', session.id)
      .order('transfer_date', { ascending: false }),
  ])

  if (animalsRes.error)   return NextResponse.json({ error: animalsRes.error.message }, { status: 500 })
  if (transfersRes.error) return NextResponse.json({ error: transfersRes.error.message }, { status: 500 })

  type Animal = {
    id: string; tag_number: string; name: string | null; sex: string | null
    breed: string | null; ear_tag_color: string | null
    purchase_date: string | null; purchase_price: number | null; vendor: string | null
    origin: string | null; purchased_as_pair: boolean | null; pair_animal_id: string | null
  }
  type Transfer = {
    animal_id: string; from_owner_id: string | null
    transfer_date: string; fmv_at_transfer: number | null
  }

  const animals   = (animalsRes.data ?? []) as Animal[]
  const transfers = (transfersRes.data ?? []) as Transfer[]
  const byId      = new Map(animals.map(a => [a.id, a]))

  // Who they bought from, by name.
  const sellerIds = [...new Set(transfers.map(t => t.from_owner_id).filter((x): x is string => Boolean(x)))]
  const sellerNames = new Map<string, string>()
  if (sellerIds.length > 0) {
    const { data: owners } = await supabase
      .from('grazing_owners')
      .select('id, name, owner_name, company_name, is_self')
      .in('id', sellerIds)
    for (const o of (owners ?? []) as Array<{ id: string; name: string | null; owner_name: string | null; company_name: string | null; is_self: boolean | null }>) {
      sellerNames.set(o.id, o.company_name || o.owner_name || o.name || 'the ranch')
    }
  }

  // The most recent transfer per animal — if it changed hands twice, what
  // they paid is what they paid the last time.
  const latestTransfer = new Map<string, Transfer>()
  for (const t of transfers) {
    if (!latestTransfer.has(t.animal_id)) latestTransfer.set(t.animal_id, t)
  }

  const describe = (a: Animal, isPair: boolean) => {
    const bits = [a.ear_tag_color, a.breed].filter(Boolean).join(' ')
    const kind = isPair ? 'pair' : (a.sex ?? 'animal')
    return `${bits ? bits + ' ' : ''}${kind}`.trim()
  }

  const used = new Set<string>()
  const rows: PurchaseRow[] = []

  for (const a of animals) {
    if (used.has(a.id)) continue

    const pair = a.purchased_as_pair && a.pair_animal_id ? byId.get(a.pair_animal_id) : undefined

    // The cow carries the price. Between a pair, she is the record of it.
    const cow = pair
      ? (a.sex === 'calf' ? pair : a)
      : a
    const calf = pair ? (cow === a ? pair : a) : undefined

    const transfer = latestTransfer.get(cow.id) ?? (calf ? latestTransfer.get(calf.id) : undefined)

    let row: PurchaseRow | null = null

    if (transfer) {
      row = {
        animal_ids: calf ? [cow.id, calf.id] : [cow.id],
        date:   transfer.transfer_date,
        cost:   transfer.fmv_at_transfer != null ? Number(transfer.fmv_at_transfer) : null,
        seller: transfer.from_owner_id ? (sellerNames.get(transfer.from_owner_id) ?? 'the ranch') : 'the ranch',
        description: describe(cow, Boolean(calf)),
        tag: calf ? `${cow.tag_number} & ${calf.tag_number}` : cow.tag_number,
        source: 'transfer',
      }
    } else if (cow.purchase_price != null || cow.purchase_date != null || cow.vendor) {
      // Bought from outside by this owner — an auction, a neighbour.
      row = {
        animal_ids: calf ? [cow.id, calf.id] : [cow.id],
        date:   cow.purchase_date,
        cost:   cow.purchase_price != null ? Number(cow.purchase_price) : null,
        seller: cow.vendor,
        description: describe(cow, Boolean(calf)),
        tag: calf ? `${cow.tag_number} & ${calf.tag_number}` : cow.tag_number,
        source: 'outside',
      }
    }

    used.add(a.id)
    if (calf) used.add(calf.id)
    if (row) rows.push(row)
  }

  const filtered = rows.filter(r => withinPeriod(r.date, period))

  filtered.sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date)
    if (a.date) return -1
    if (b.date) return 1
    return a.tag.localeCompare(b.tag)
  })

  const priced = filtered.filter(r => r.cost != null)

  return NextResponse.json({
    data: filtered,
    summary: {
      purchases:     filtered.length,
      head:          filtered.reduce((s, r) => s + r.animal_ids.length, 0),
      total:         priced.reduce((s, r) => s + (r.cost ?? 0), 0),
      missing_price: filtered.length - priced.length,
    },
    period: { key: period.key, label: period.label, start: period.start, end: period.end },
    // Undated purchases fall outside every bounded period. Said out loud so a
    // short list reads as a filter doing its job, not as missing records.
    undated: rows.filter(r => !r.date).length,
  })
}
