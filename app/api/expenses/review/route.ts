export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/expenses/review[?include_reviewed=true]
//
// The queue: receipts that arrived by email and have not been confirmed yet.
// Line decisions are pre-filled by the matcher, so this is a confirmation
// screen rather than a data-entry one.
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const includeReviewed = req.nextUrl.searchParams.get('include_reviewed') === 'true'

  let query = supabase
    .from('inbound_receipts')
    .select(`
      id, r2_key, filename, content_type, vendor, receipt_date, receipt_total,
      parse_status, parse_error, reviewed_at, created_at,
      email:email_id ( id, from_address, subject, received_at ),
      line_items:receipt_line_items (
        id, line_no, description, amount,
        suggested_category_id, suggested_category_name,
        matched_expense_id, matched_split_group_id, match_score, match_reason,
        decision, created_expense_id
      )
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (!includeReviewed) query = query.is('reviewed_at', null)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const receipts = (data ?? []) as unknown as Array<{
    id: string
    line_items: Array<{ matched_expense_id: string | null; line_no: number }>
  }>

  // The matched expenses, so the queue can show what it wants to attach to
  // rather than a bare id.
  const matchedIds = [...new Set(
    receipts.flatMap(r => r.line_items.map(l => l.matched_expense_id)).filter((x): x is string => !!x),
  )]

  let matched: unknown[] = []
  if (matchedIds.length > 0) {
    const { data: rows } = await supabase
      .from('lease_expenses')
      .select('id, description, category_name, total_amount, expense_date, split_group_id, receipt_url')
      .in('id', matchedIds)
    matched = rows ?? []
  }

  // Line items come back from PostgREST in arbitrary order.
  for (const r of receipts) r.line_items.sort((a, b) => a.line_no - b.line_no)

  return NextResponse.json({ data: receipts, matched_expenses: matched })
}
