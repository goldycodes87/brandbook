// Shaping an incoming payload into a lease_expenses row.
//
// Lives here rather than inside the POST route because the split-edit path
// rebuilds rows too, and a row created one way and rebuilt another is how a
// split ends up with a quarter that does not match the expense it replaced.

export type ExpenseBody = Record<string, unknown>

/** Quarter and year (2-digit, matching lease_expenses.year) an expense falls in. */
export function resolvePeriod(
  body: ExpenseBody,
): { year: number | null; quarter: number | null } {
  const rawYear    = body.year
  const rawQuarter = body.quarter

  let year:    number | null = rawYear    != null ? Number(rawYear)    : null
  let quarter: number | null = rawQuarter != null ? Number(rawQuarter) : null

  const expenseDate = body.expense_date
  if ((year === null || quarter === null) && typeof expenseDate === 'string' && expenseDate) {
    const d = new Date(expenseDate)
    if (year    === null) year    = d.getFullYear() % 100
    if (quarter === null) quarter = Math.ceil((d.getMonth() + 1) / 3)
  }

  return { year, quarter }
}

/** Shape one incoming payload into a lease_expenses row. */
export function buildExpenseRow(body: ExpenseBody) {
  const b = body as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  const { year, quarter } = resolvePeriod(body)

  return {
    lease_id:          null,
    is_lease_specific: false,
    category_name:     b.category_name,
    category_id:       b.category_id     || null,
    expense_type:      b.expense_type    || 'shared',
    description:       b.description     || null,
    total_amount:      Number(b.total_amount),
    expense_date:      b.expense_date    || null,
    receipt_url:       b.receipt_url     || null,
    period_start:      b.period_start    || null,
    period_end:        b.period_end      || null,
    owner_id:          b.owner_id        || null,
    animal_id:         b.animal_id       || null,
    year,
    quarter,
    notes:             b.notes           || null,
    qty:               b.qty             != null ? Number(b.qty)       : null,
    unit_cost:         b.unit_cost       != null ? Number(b.unit_cost) : null,
    sire_library_id:        b.sire_library_id       || null,
    bull_name:              b.bull_name             || null,
    include_calves:         Boolean(b.include_calves),
    reproduction_event_id:  b.reproduction_event_id || null,
    split_group_id:         b.split_group_id        || null,
  }
}

export function missingRequired(body: ExpenseBody): boolean {
  return !body.category_name || body.total_amount === undefined || body.total_amount === null
}
