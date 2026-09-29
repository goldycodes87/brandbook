export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOwnerSession } from '@/lib/owner-auth'

/**
 * What this owner has bought: date, what it was, what it cost, who sold it.
 *
 * The answer a person wants at tax time and the one that was hardest to get —
 * it lived one field at a time across the animal records, and nothing put it
 * in a row.
 *
 * Two things this has to get right or it is worse than nothing:
 *
 *   Pairs are one purchase. A cow bought with a calf at side is a single
 *   transaction at a single price, and the price sits on whichever of the two
 *   rows it was typed into. Listing them separately either doubles the money
 *   or shows a calf that cost nothing.
 *
 *   Missing is missing. A vendor with no price and no date is a real state in
 *   this data, and it goes out as a row with blanks rather than a zero. A zero
 *   is a claim that something was free.
 */

interface PurchaseRow {
  animal_ids: string[]
  date: string | null
  description: string
  tag: string
  cost: number | null
  seller: string | null
  incomplete: string[]
}

export async function GET(req: NextRequest) {
  const session = await getOwnerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const yearParam = req.nextUrl.searchParams.get('year')
  const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : null

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('animals')
    .select('id, tag_number, name, sex, breed, ear_tag_color, purchase_date, purchase_price, vendor, origin, purchased_as_pair, pair_animal_id, status')
    .eq('owner_id', session.id)
    .order('tag_number', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type Row = {
    id: string; tag_number: string; name: string | null; sex: string | null
    breed: string | null; ear_tag_color: string | null
    purchase_date: string | null; purchase_price: number | null; vendor: string | null
    origin: string | null; purchased_as_pair: boolean | null; pair_animal_id: string | null
    status: string | null
  }

  const all = (data ?? []) as Row[]
  const byId = new Map(all.map(a => [a.id, a]))

  // Home-raised is not a purchase. Anything carrying a price, a date or a
  // seller is, whatever `origin` happens to say — the field was added later
  // than some of these rows.
  const bought = all.filter(a =>
    a.origin === 'purchased' || a.purchase_price != null || a.purchase_date != null || a.vendor)

  const used = new Set<string>()
  const rows: PurchaseRow[] = []

  const describe = (a: Row, pair?: Row) => {
    const bits = [a.ear_tag_color, a.breed].filter(Boolean).join(' ')
    const kind = pair ? 'pair' : (a.sex ?? 'animal')
    return `${bits ? bits + ' ' : ''}${kind}`.trim()
  }

  for (const a of bought) {
    if (used.has(a.id)) continue

    const pair = a.purchased_as_pair && a.pair_animal_id ? byId.get(a.pair_animal_id) : undefined
    if (pair) { used.add(pair.id) }
    used.add(a.id)

    // Which of the pair is the record of the transaction?
    //
    // Not "whichever came back first" — Doug's pair carries 17 May on the cow
    // and 15 Apr on the calf, so row order would decide the date on a tax
    // document. The one holding the PRICE is the one the purchase was entered
    // against; its date and seller go with its money. Fall back to the other
    // only for a field the primary is missing.
    const primary   = a.purchase_price != null ? a
                    : pair?.purchase_price != null ? pair
                    : a
    const secondary = primary === a ? pair : a

    const cost   = primary.purchase_price ?? secondary?.purchase_price ?? null
    const date   = primary.purchase_date  ?? secondary?.purchase_date  ?? null
    const seller = primary.vendor         ?? secondary?.vendor         ?? null

    const missing: string[] = []
    if (date === null)   missing.push('date')
    if (cost === null)   missing.push('price')
    if (seller === null) missing.push('seller')

    rows.push({
      animal_ids: pair ? [a.id, pair.id] : [a.id],
      date,
      description: describe(primary, pair ? secondary : undefined),
      tag: pair ? `${a.tag_number} & ${pair.tag_number}` : a.tag_number,
      cost: cost != null ? Number(cost) : null,
      seller,
      incomplete: missing,
    })
  }

  const filtered = year === null
    ? rows
    : rows.filter(r => r.date?.slice(0, 4) === String(year))

  // Undated last: they are real purchases with a gap, not the oldest ones.
  filtered.sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date)
    if (a.date) return -1
    if (b.date) return 1
    return a.tag.localeCompare(b.tag)
  })

  const known = filtered.filter(r => r.cost != null)

  return NextResponse.json({
    data: filtered,
    summary: {
      purchases:      filtered.length,
      head:           filtered.reduce((s, r) => s + r.animal_ids.length, 0),
      total:          known.reduce((s, r) => s + (r.cost ?? 0), 0),
      // Said plainly, because a total that quietly omits rows is a wrong total.
      missing_price:  filtered.length - known.length,
    },
    years: [...new Set(rows.map(r => r.date?.slice(0, 4)).filter(Boolean))].sort().reverse(),
  })
}
