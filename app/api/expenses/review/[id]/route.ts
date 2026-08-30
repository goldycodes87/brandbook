export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildExpenseRow } from '@/lib/expense-row'
import { buildAnimalSplitRows } from '@/lib/expense-split'
import { randomUUID } from 'node:crypto'

type Params = { params: Promise<{ id: string }> }

interface LineDecision {
  id: string
  decision: 'create' | 'attach' | 'skip'
  description?: string | null
  amount?: number
  category_id?: string | null
  category_name?: string | null
  expense_type?: 'shared' | 'owner_specific' | 'animal_specific'
  owner_id?: string | null
  animal_ids?: string[]
  matched_expense_id?: string | null
  include_calves?: boolean
}

const publicUrl = (key: string) => `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`

// POST /api/expenses/review/[id] — commit the decisions on one receipt.
//
// Three outcomes per line, and they are genuinely different:
//   create — a new expense, carrying the receipt and the vendor
//   attach — already recorded; the receipt is filed against it, no new money
//   skip   — not a ranch expense (the bag of dog food). Nothing is written.
export async function POST(req: NextRequest, { params }: Params) {
  const { id }   = await params
  const body     = await req.json()
  const supabase = createAdminClient()

  const lines: LineDecision[] = Array.isArray(body?.lines) ? body.lines : []
  if (lines.length === 0) {
    return NextResponse.json({ error: 'lines required' }, { status: 400 })
  }

  const { data: receipt } = await supabase
    .from('inbound_receipts')
    .select('id, r2_key, vendor, receipt_date, reviewed_at')
    .eq('id', id)
    .maybeSingle()

  if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })

  const r = receipt as { id: string; r2_key: string; vendor: string | null; receipt_date: string | null; reviewed_at: string | null }
  if (r.reviewed_at) {
    // Re-submitting would book every 'create' line a second time.
    return NextResponse.json({ error: 'This receipt has already been reviewed.' }, { status: 409 })
  }

  const receiptUrl = publicUrl(r.r2_key)
  const now = new Date().toISOString()

  let created = 0, attached = 0, skipped = 0
  const problems: string[] = []

  for (const line of lines) {
    try {
      if (line.decision === 'skip') {
        await supabase.from('receipt_line_items')
          .update({ decision: 'skip', decided_at: now })
          .eq('id', line.id)
        skipped++
        continue
      }

      if (line.decision === 'attach') {
        const target = line.matched_expense_id
        if (!target) { problems.push(`${line.description ?? 'a line'}: nothing to attach to`); continue }

        // A split is one expense across many rows — file the receipt against
        // every row so it shows up whichever one you open.
        const { data: targetRow } = await supabase
          .from('lease_expenses').select('id, split_group_id').eq('id', target).maybeSingle()
        const groupId = (targetRow as { split_group_id: string | null } | null)?.split_group_id

        const update = supabase.from('lease_expenses').update({ receipt_url: receiptUrl, vendor: r.vendor })
        const { error } = groupId
          ? await update.eq('split_group_id', groupId)
          : await update.eq('id', target)
        if (error) { problems.push(`${line.description ?? 'a line'}: ${error.message}`); continue }

        await supabase.from('receipt_line_items')
          .update({ decision: 'attach', matched_expense_id: target, decided_at: now })
          .eq('id', line.id)
        attached++
        continue
      }

      // create
      const amount = Number(line.amount)
      if (!Number.isFinite(amount)) { problems.push(`${line.description ?? 'a line'}: no amount`); continue }
      if (!line.category_name)      { problems.push(`${line.description ?? 'a line'}: pick a category`); continue }

      const shared = {
        category_name: line.category_name,
        category_id:   line.category_id ?? null,
        description:   line.description ?? null,
        expense_date:  r.receipt_date,
        receipt_url:   receiptUrl,
        vendor:        r.vendor,
        include_calves: line.expense_type === 'shared' ? Boolean(line.include_calves) : false,
      }

      let createdId: string | null = null

      if (line.expense_type === 'animal_specific' && (line.animal_ids?.length ?? 0) > 0) {
        // Reuse the split builder so an emailed receipt divides money exactly
        // the way the chute and the expense sheet do.
        const { data: animals } = await supabase
          .from('animals').select('id, owner_id').in('id', line.animal_ids!)
        const { data: selfOwner } = await supabase
          .from('grazing_owners').select('id').eq('is_self', true).maybeSingle()

        const splitRows = buildAnimalSplitRows({
          animalIds:   line.animal_ids!,
          animals:     (animals ?? []) as Array<{ id: string; owner_id: string | null }>,
          selfOwnerId: (selfOwner as { id: string } | null)?.id ?? null,
          totalAmount: amount,
          categoryName: line.category_name,
          categoryId:   line.category_id ?? null,
          description:  line.description ?? null,
          expenseDate:  r.receipt_date,
        })

        const groupId = randomUUID()
        const { data: inserted, error } = await supabase
          .from('lease_expenses')
          .insert(splitRows.map(row => ({
            ...buildExpenseRow({ ...row, ...shared, total_amount: row.total_amount }),
            split_group_id: groupId,
          })))
          .select('id')
        if (error) { problems.push(`${line.description ?? 'a line'}: ${error.message}`); continue }
        createdId = (inserted?.[0] as { id: string } | undefined)?.id ?? null

      } else {
        const { data: inserted, error } = await supabase
          .from('lease_expenses')
          .insert(buildExpenseRow({
            ...shared,
            total_amount: amount,
            expense_type: line.expense_type ?? 'shared',
            owner_id:     line.expense_type === 'owner_specific' ? line.owner_id ?? null : null,
          }))
          .select('id')
          .single()
        if (error) { problems.push(`${line.description ?? 'a line'}: ${error.message}`); continue }
        createdId = (inserted as { id: string }).id
      }

      await supabase.from('receipt_line_items')
        .update({ decision: 'create', created_expense_id: createdId, decided_at: now })
        .eq('id', line.id)
      created++

    } catch (e) {
      problems.push(`${line.description ?? 'a line'}: ${e instanceof Error ? e.message : 'failed'}`)
    }
  }

  // Only close the receipt if every line landed. A partial submit stays in the
  // queue so the failures are still visible and re-runnable.
  if (problems.length === 0) {
    await supabase.from('inbound_receipts').update({ reviewed_at: now }).eq('id', id)
  }

  return NextResponse.json({
    ok: problems.length === 0,
    created, attached, skipped,
    problems,
  })
}
