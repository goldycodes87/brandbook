// Checks on the expense-split math in lib/expense-allocation.ts.
//
//   npm run check:allocation
//
// This file exists because the split is the one place in the app where a quiet
// arithmetic slip turns into a wrong number on a customer's invoice, and the
// only other way to test it is to cut a real invoice and read it. No test
// framework here — the module is pure, so plain assertions are enough.
//
// Transpiled in-process with the typescript devDependency: the module imports
// through the '@/' alias, which node cannot resolve on its own.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT  = fs.mkdtempSync(path.join(os.tmpdir(), 'brandbook-alloc-'))

for (const name of ['lease-calculations', 'expense-allocation']) {
  const src = fs.readFileSync(path.join(ROOT, 'lib', name + '.ts'), 'utf8')
  const js  = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
    // '@/lib/x' -> './x.js': node's ESM resolver needs the alias gone AND the
    // extension present.
  }).outputText.replace(/'@\/lib\/([\w-]+)'/g, "'./$1.js'")
  fs.writeFileSync(path.join(OUT, name + '.js'), js)
}

const { computeExpenseAllocations, computeHerdDays } =
  await import(pathToFileURL(path.join(OUT, 'expense-allocation.js')).href)

let failures = 0
function check(name, cond, detail) {
  if (cond) { console.log('  ok   ' + name) }
  else { failures++; console.log('  FAIL ' + name + (detail ? '  ->  ' + detail : '')) }
}
const cents = n => Math.round(n * 100)
const sum   = xs => xs.reduce((s, x) => s + x, 0)

const SELF = 'self-owner'
const A = 'owner-a', B = 'owner-b', C = 'owner-c'

// 631 / 723 / 90 of 1444 animal-days is the real Q3 2026 herd shape — the one
// that produced a $750.01 split of a $750.00 expense under per-owner rounding.
// The window is deliberately wider than a quarter so one animal can carry 723
// days; clamping to 92 would flatten the ratio and test nothing.
const HERD_WINDOW = { windowStart: '2026-01-01', windowEnd: '2030-01-01' }

function herd(days) {
  const rows = [
    { animal_id: 'a1', owner_id: A,    sex: 'cow', weaning_date: null, dam_id: null, _days: days[0] },
    { animal_id: 'b1', owner_id: null, sex: 'cow', weaning_date: null, dam_id: null, _days: days[1] },
    { animal_id: 'c1', owner_id: C,    sex: 'cow', weaning_date: null, dam_id: null, _days: days[2] },
  ]
  return rows.map(r => {
    const start = new Date('2026-01-01T00:00:00')
    const end   = new Date(start.getTime() + r._days * 86400000)
    return { ...r, start_date: '2026-01-01', end_date: end.toISOString().slice(0, 10) }
  })
}

console.log('\n1. shares sum to the expense total, exactly')
{
  const assignments = herd([631, 723, 90])
  const expenses = [
    { id: 'e1', total_amount: 750,    expense_type: 'shared' },
    { id: 'e2', total_amount: 21.98,  expense_type: 'shared' },
    { id: 'e3', total_amount: 459.98, expense_type: 'shared' },
    { id: 'e4', total_amount: 636,    expense_type: 'shared' },
    { id: 'e5', total_amount: 0.01,   expense_type: 'shared' },
    { id: 'e6', total_amount: 1,      expense_type: 'shared' },
  ]
  const { allocations } = computeExpenseAllocations({
    expenses, assignments, ...HERD_WINDOW, selfOwnerId: SELF,
  })
  for (const e of expenses) {
    const mine  = allocations.filter(a => a.expense_id === e.id)
    const total = sum(mine.map(a => cents(a.amount)))
    check(`$${e.total_amount} splits to exactly ${cents(e.total_amount)}c`, total === cents(e.total_amount),
      `got ${total}c across ${mine.length} owners: ${mine.map(m => m.amount).join(' + ')}`)
  }
  // Rounding each owner independently gives 327.74 + 375.52 + 46.75 = 750.01.
  const e1 = allocations.filter(a => a.expense_id === 'e1').map(a => a.amount).sort((x, y) => y - x)
  check('the $750 split is 375.52 / 327.74 / 46.74', JSON.stringify(e1) === JSON.stringify([375.52, 327.74, 46.74]),
    JSON.stringify(e1))
}

console.log('\n2. ranch-owned rolls into the self owner, not a phantom bucket')
{
  const assignments = herd([631, 723, 90])
  const expenses = [{ id: 'e1', total_amount: 100, expense_type: 'shared' }]

  const { allocations } = computeExpenseAllocations({ expenses, assignments, ...HERD_WINDOW, selfOwnerId: SELF })
  check('ranch share lands on selfOwnerId', allocations.some(a => a.owner_id === SELF))
  check('no null-owner share when selfOwnerId is set', !allocations.some(a => a.owner_id === null))

  const noSelf = computeExpenseAllocations({ expenses, assignments, ...HERD_WINDOW, selfOwnerId: null }).allocations
  check('falls back to a null-owner share when no is_self row exists', noSelf.some(a => a.owner_id === null))
  check('still sums to the total without a self owner', sum(noSelf.map(a => cents(a.amount))) === 10000)
}

console.log('\n3. pair calves add no days of their own')
{
  const base = [
    { animal_id: 'dam', start_date: '2026-07-01', end_date: '2026-07-31', owner_id: A, sex: 'cow',  weaning_date: null, dam_id: null },
    { animal_id: 'clf', start_date: '2026-07-01', end_date: '2026-07-31', owner_id: A, sex: 'calf', weaning_date: null, dam_id: 'dam' },
    { animal_id: 'oth', start_date: '2026-07-01', end_date: '2026-07-31', owner_id: B, sex: 'cow',  weaning_date: null, dam_id: null },
  ]
  const opts = { assignments: base, windowStart: '2026-07-01', windowEnd: '2026-07-31', selfOwnerId: SELF }

  const excl = computeExpenseAllocations({ ...opts, expenses: [{ id: 'e', total_amount: 100, expense_type: 'shared' }] }).allocations
  check('pair calf excluded by default -> 50/50', excl.find(x => x.owner_id === A).amount === 50,
    `owner A got ${excl.find(x => x.owner_id === A).amount}`)

  const incl = computeExpenseAllocations({ ...opts, expenses: [{ id: 'e', total_amount: 90, expense_type: 'shared', include_calves: true }] }).allocations
  check('include_calves true -> calf counts, A gets 2/3', incl.find(x => x.owner_id === A).amount === 60,
    `owner A got ${incl.find(x => x.owner_id === A).amount}`)

  // A calf whose dam is not in this set is nobody's pair — it stands on its own.
  const orphan = computeExpenseAllocations({
    ...opts,
    assignments: base.filter(a => a.animal_id !== 'dam'),
    expenses: [{ id: 'e', total_amount: 100, expense_type: 'shared' }],
  }).allocations
  check('calf without its dam in scope counts as its own unit', orphan.find(x => x.owner_id === A).amount === 50)
}

console.log('\n4. one_time lands on its date; period uses its own window')
{
  const assignments = [
    { animal_id: 'x', start_date: '2026-07-01', end_date: '2026-07-10', owner_id: A, sex: 'cow', weaning_date: null, dam_id: null },
    { animal_id: 'y', start_date: '2026-07-20', end_date: '2026-07-31', owner_id: B, sex: 'cow', weaning_date: null, dam_id: null },
  ]
  const opts = { assignments, windowStart: '2026-07-01', windowEnd: '2026-07-31', selfOwnerId: SELF }

  const oneTime = computeExpenseAllocations({ ...opts, expenses: [
    { id: 'e', total_amount: 100, expense_type: 'shared', calculation_type: 'one_time', expense_date: '2026-07-05' },
  ] }).allocations
  check('one_time on 07-05 bills only the owner present that day',
    oneTime.length === 1 && oneTime[0].owner_id === A && oneTime[0].amount === 100,
    JSON.stringify(oneTime.map(o => [o.owner_id, o.amount])))

  const period = computeExpenseAllocations({ ...opts, expenses: [
    { id: 'e', total_amount: 100, expense_type: 'shared', period_start: '2026-07-20', period_end: '2026-07-31' },
  ] }).allocations
  check('period 07-20..07-31 bills only the owner present then',
    period.length === 1 && period[0].owner_id === B && period[0].amount === 100,
    JSON.stringify(period.map(o => [o.owner_id, o.amount])))
}

console.log('\n5. single-owner kinds bypass the split entirely')
{
  const { allocations } = computeExpenseAllocations({
    assignments: herd([631, 723, 90]), ...HERD_WINDOW, selfOwnerId: SELF,
    expenses: [
      { id: 'o', total_amount: 175, expense_type: 'shared', category_expense_type: 'owner_specific', owner_id: A },
      { id: 'n', total_amount: 25,  expense_type: 'animal_specific', animal_id: 'a1' },
    ],
  })
  const o = allocations.filter(a => a.expense_id === 'o')
  check('category expense_type wins over the row column', o.length === 1 && o[0].kind === 'owner_specific')
  check('owner_specific bills the whole amount to one owner', o[0].owner_id === A && o[0].amount === 175)

  // The AI-fee rows carry expense_type 'animal_specific' on the row and
  // 'owner_specific' on the category — this is that case, in reverse.
  const n = allocations.filter(a => a.expense_id === 'n')
  check('animal_specific resolves the owner from the animal',
    n.length === 1 && n[0].owner_id === SELF && n[0].amount === 25,
    JSON.stringify(n.map(x => [x.owner_id, x.amount])))
}

console.log('\n6. money with nowhere to go is reported, not silently dropped')
{
  const { allocations, unallocated } = computeExpenseAllocations({
    assignments: [], windowStart: '2026-07-01', windowEnd: '2026-09-30', selfOwnerId: SELF,
    expenses: [{ id: 'e', total_amount: 500, expense_type: 'shared' }],
  })
  check('no allocations when nothing was grazing', allocations.length === 0)
  check('the $500 is surfaced as unallocated', unallocated.length === 1 && unallocated[0].amount === 500)
}

console.log('\n7. the split is deterministic across runs')
{
  const assignments = herd([7, 7, 7])   // a perfect 3-way tie: 100c / 3
  const runs = []
  for (let i = 0; i < 5; i++) {
    runs.push(JSON.stringify(computeExpenseAllocations({
      assignments, ...HERD_WINDOW, selfOwnerId: SELF,
      expenses: [{ id: 'e', total_amount: 100, expense_type: 'shared' }],
    }).allocations.map(a => [a.owner_id, a.amount]).sort()))
  }
  check('a tied 3-way split of $100 is stable', new Set(runs).size === 1, runs[0])
  check('a tied 3-way split of $100 still sums to 10000c',
    sum(JSON.parse(runs[0]).map(r => cents(r[1]))) === 10000, runs[0])
}

console.log('\n8. herd-days match the split denominator')
{
  const { byOwner, total } = computeHerdDays({ assignments: herd([631, 723, 90]), ...HERD_WINDOW, selfOwnerId: SELF })
  check('herd-days total equals the sum of its parts', sum([...byOwner.values()]) === total, `${total}`)
  check('every owner with animals has days', byOwner.size === 3, `${byOwner.size}`)
  check('the ranch bucket is keyed to the self owner', byOwner.get(SELF) === 723, `${byOwner.get(SELF)}`)
}

fs.rmSync(OUT, { recursive: true, force: true })

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} CHECK(S) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
