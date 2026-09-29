export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOwnerSession } from '@/lib/owner-auth'
import { generateReportPdfBuffer } from '@/lib/generate-invoice-pdf'
import { resolvePeriod, type PeriodKey } from '@/lib/purchase-periods'
import { GET as purchasesJson } from '@/app/api/portals/owner/purchases/route'

/**
 * The purchases report as a document somebody can send an accountant.
 *
 * Built on generateReportPdfBuffer — a real pdf-lib layout with a header bar
 * and ruled tables — rather than generatePDF, which strips every tag out of
 * the HTML it is handed and prints the leftover words. The annual report goes
 * through that one, which is why it comes out as a wall of text.
 *
 * The rows come from the JSON route rather than a second query, so the PDF and
 * the screen cannot drift. That mattered more than saving a call: the two are
 * read side by side, and a difference between them is a difference nobody can
 * explain.
 */
export async function GET(req: NextRequest) {
  const session = await getOwnerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = (req.nextUrl.searchParams.get('period') ?? 'all_time') as PeriodKey
  const period = resolvePeriod(key)

  const res = await purchasesJson(req)
  const json = await res.json()
  if (!res.ok) return NextResponse.json({ error: json.error ?? 'Could not build the report' }, { status: 500 })

  const rows = (json.data ?? []) as Array<{
    date: string | null; description: string; tag: string
    cost: number | null; seller: string | null
  }>
  const summary = json.summary as { purchases: number; head: number; total: number; missing_price: number }

  const supabase = createAdminClient()
  const [{ data: ranch }, { data: owner }] = await Promise.all([
    supabase.from('ranch_settings').select('ranch_name').limit(1).maybeSingle(),
    supabase.from('grazing_owners').select('name, owner_name, company_name').eq('id', session.id).maybeSingle(),
  ])

  const ranchName = (ranch as { ranch_name: string | null } | null)?.ranch_name?.trim() || 'Brand Book'
  const o = owner as { name: string | null; owner_name: string | null; company_name: string | null } | null
  const ownerName = o?.company_name || o?.owner_name || o?.name || 'Owner'

  const money = (n: number) => `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
  const day = (d: string | null) =>
    d ? new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US',
      { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : 'not recorded'

  const sections = [
    {
      heading: 'SUMMARY',
      rows: [
        { label: 'Owner',   value: ownerName },
        { label: 'Period',  value: period.label },
        { label: 'Purchases', value: String(summary.purchases) },
        { label: 'Head',      value: String(summary.head) },
        { label: 'Total paid', value: money(summary.total) },
        // Only when it is true. A line reading "0 with no price" on every
        // report teaches the reader to skip the line that matters.
        ...(summary.missing_price > 0
          ? [{ label: 'Purchases with no price recorded', value: String(summary.missing_price) }]
          : []),
      ],
    },
    {
      heading: 'PURCHASES',
      rows: [],
      table: {
        columns: ['Date', 'What', 'Tag', 'Seller', 'Cost'],
        rows: rows.map(r => [
          day(r.date),
          r.description,
          r.tag,
          r.seller ?? 'not recorded',
          r.cost != null ? money(r.cost) : '—',
        ]),
      },
    },
  ]

  const pdf = await generateReportPdfBuffer(
    `${ownerName} — Purchases · ${period.label}`,
    sections,
  )

  const safe = ownerName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safe}-purchases-${period.key}.pdf"`,
      'Cache-Control': 'no-store',
      'X-Ranch': ranchName,
    },
  })
}
