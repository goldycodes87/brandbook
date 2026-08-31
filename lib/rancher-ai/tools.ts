import type Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildAllocationReport } from '@/lib/expense-allocation-report'

/**
 * What RancherAI can actually do.
 *
 * One definition per tool, holding both the schema Claude sees and the function
 * that runs. Keeping them together is the point: a tool whose description has
 * drifted from its behaviour is worse than no tool, because the model will
 * confidently call it.
 *
 * Two rules the handlers all follow:
 *
 * 1. Return shaped data, not table rows. The model is answering a rancher, so
 *    a tool returns "P&L Cattle Co" and "due May 14", not an owner_id and an
 *    ISO timestamp it has to reason about.
 * 2. Say when the answer is empty and why. `{ animals: [] }` invites the model
 *    to invent; `{ animals: [], note: 'No owner matched "P&L"' }` does not.
 *
 * Write tools are in this file too, but every one of them returns a proposal
 * rather than performing the write — see PROPOSE_ONLY below.
 */

export interface ToolResult {
  [k: string]: unknown
}

export interface RancherTool {
  spec: Anthropic.Tool
  run: (input: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>
}

export interface ToolContext {
  ranchId: string | null
  /** Who is asking. Written onto anything this turn creates. */
  authUserId: string
  /** Today, in the ranch's timezone, as YYYY-MM-DD. Passed in so the tools stay pure of the clock. */
  today: string
}

type DB = ReturnType<typeof createAdminClient>

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : null }
const money = (n: number) => `$${n.toFixed(2)}`

/** Month name → 1-12, so "May" works as well as "2026-05". */
const MONTHS = ['january','february','march','april','may','june',
                'july','august','september','october','november','december']

/**
 * Turn what a person says about time into a date range.
 * Accepts "May", "May 2027", "2026-05", "Q3", "next 30 days", or a plain range.
 */
export function resolveRange(text: string, today: string): { start: string; end: string; label: string } | null {
  const t = text.trim().toLowerCase()
  const thisYear = Number(today.slice(0, 4))

  const days = t.match(/^next\s+(\d+)\s+days?$/)
  if (days) {
    const end = new Date(`${today}T00:00:00Z`)
    end.setUTCDate(end.getUTCDate() + Number(days[1]))
    return { start: today, end: end.toISOString().slice(0, 10), label: `the next ${days[1]} days` }
  }

  const q = t.match(/^q([1-4])(?:\s+(\d{4}))?$/)
  if (q) {
    const year = q[2] ? Number(q[2]) : thisYear
    const startMonth = (Number(q[1]) - 1) * 3
    const start = new Date(Date.UTC(year, startMonth, 1))
    const end   = new Date(Date.UTC(year, startMonth + 3, 0))
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), label: `Q${q[1]} ${year}` }
  }

  const month = t.match(/^([a-z]+)(?:\s+(\d{4}))?$/)
  if (month) {
    const idx = MONTHS.indexOf(month[1])
    if (idx >= 0) {
      const year = month[2] ? Number(month[2]) : thisYear
      const start = new Date(Date.UTC(year, idx, 1))
      const end   = new Date(Date.UTC(year, idx + 1, 0))
      return {
        start: start.toISOString().slice(0, 10),
        end:   end.toISOString().slice(0, 10),
        label: `${month[1][0].toUpperCase()}${month[1].slice(1)} ${year}`,
      }
    }
  }

  const iso = t.match(/^(\d{4})-(\d{2})$/)
  if (iso) {
    const start = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, 1))
    const end   = new Date(Date.UTC(Number(iso[1]), Number(iso[2]), 0))
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), label: t }
  }

  return null
}

/**
 * Find one owner from however the rancher said their name.
 *
 * "P&L", "P and L Cattle", "Andy", "Holloman" all have to land on the right
 * row, and landing on the WRONG row is the failure that matters — it would put
 * one man's cattle on another man's bill. So an ambiguous match returns the
 * candidates instead of guessing.
 */
async function matchOwner(supabase: DB, term: string) {
  const { data } = await supabase
    .from('grazing_owners')
    .select('id, name, company_name, owner_name, email, phone, is_self')

  const owners = (data ?? []) as Array<{
    id: string; name: string | null; company_name: string | null
    owner_name: string | null; email: string | null; phone: string | null; is_self: boolean | null
  }>

  // Compared with the punctuation and spaces taken out, because "P&L",
  // "P & L" and "P and L" are one ranch with three spellings.
  const norm = (s: string) => s.toLowerCase().replace(/\band\b/g, '&').replace(/[^a-z0-9&]/g, '')
  const needle = norm(term)
  if (!needle) return { match: null, candidates: [] as typeof owners }

  const scored = owners
    .map(o => {
      const fields = [o.company_name, o.owner_name, o.name].filter(Boolean).map(f => norm(String(f)))
      if (fields.some(f => f === needle))            return { o, rank: 3 }
      if (fields.some(f => f.startsWith(needle)))    return { o, rank: 2 }
      if (fields.some(f => f.includes(needle)))      return { o, rank: 1 }
      return { o, rank: 0 }
    })
    .filter(s => s.rank > 0)
    .sort((a, b) => b.rank - a.rank)

  if (scored.length === 0) return { match: null, candidates: [] }
  // A single best rank wins; a tie is genuinely ambiguous.
  const top = scored.filter(s => s.rank === scored[0].rank)
  if (top.length === 1) return { match: top[0].o, candidates: [] }
  return { match: null, candidates: top.map(s => s.o) }
}

const ownerLabel = (o: { company_name: string | null; owner_name: string | null; name: string | null }) =>
  o.company_name || o.owner_name || o.name || 'Unnamed owner'

// ─── Tools ────────────────────────────────────────────────────────────────────

const findAnimals: RancherTool = {
  spec: {
    name: 'find_animals',
    description:
      "Find animals in the herd. Use for questions like 'what tag numbers belong to P&L Cattle', " +
      "'how many bred heifers do I have', 'show me everything on the cull list'. " +
      'Returns tag numbers with the details that identify an animal, not full records.',
    input_schema: {
      type: 'object',
      properties: {
        owner:  { type: 'string', description: "Owner name as the rancher said it, e.g. 'P&L', 'Andy Holloman'. Omit for the whole herd." },
        status: { type: 'string', enum: ['active', 'sold', 'deceased', 'transferred', 'harvested'], description: 'Defaults to active.' },
        sex:    { type: 'string', description: "e.g. 'cow', 'heifer', 'bull', 'steer'." },
        on_cull_list: { type: 'boolean', description: 'Only animals flagged for culling.' },
        tag:    { type: 'string', description: 'A specific tag number, or part of one.' },
        limit:  { type: 'number', description: 'Default 50, max 200.' },
      },
    },
  },
  async run(input) {
    const supabase = createAdminClient()
    let ownerId: string | null = null
    let ownerName = ''

    if (str(input.owner)) {
      const { match, candidates } = await matchOwner(supabase, str(input.owner))
      if (!match) {
        return candidates.length
          ? { animals: [], note: `More than one owner matches "${str(input.owner)}"`, candidates: candidates.map(ownerLabel) }
          : { animals: [], note: `No owner matches "${str(input.owner)}"` }
      }
      ownerId = match.id
      ownerName = ownerLabel(match)
    }

    const limit = Math.min(Math.max(num(input.limit) ?? 50, 1), 200)

    let q = supabase
      .from('animals')
      .select('tag_number, name, sex, breed, dob, status, ear_tag_color, cull_flagged_at, cull_reason, owner_id')
      .eq('status', str(input.status) || 'active')
      .order('tag_number')
      .limit(limit)

    if (ownerId)               q = q.eq('owner_id', ownerId)
    if (str(input.sex))        q = q.eq('sex', str(input.sex).toLowerCase())
    if (input.on_cull_list)    q = q.not('cull_flagged_at', 'is', null)
    if (str(input.tag))        q = q.ilike('tag_number', `%${str(input.tag)}%`)

    const { data, error } = await q
    if (error) return { error: error.message }

    const rows = (data ?? []) as Array<Record<string, unknown>>
    return {
      count: rows.length,
      owner: ownerName || 'the whole herd',
      animals: rows.map(a => ({
        tag:    a.tag_number,
        name:   a.name || null,
        sex:    a.sex,
        breed:  a.breed,
        dob:    a.dob,
        tag_color: a.ear_tag_color,
        on_cull_list: Boolean(a.cull_flagged_at),
        cull_reason:  a.cull_reason || null,
      })),
      note: rows.length === 0 ? 'Nothing matched those filters.' : undefined,
      truncated: rows.length === limit ? `Showing the first ${limit}.` : undefined,
    }
  },
}

const calvingSchedule: RancherTool = {
  spec: {
    name: 'calving_schedule',
    description:
      "Which cows are due to calve in a period. Use for 'which cows are due in May', " +
      "'what's calving in the next 30 days'. Reads confirmed pregnancies and their expected calving dates.",
    input_schema: {
      type: 'object',
      properties: {
        when: { type: 'string', description: "How the rancher said it: 'May', 'May 2027', 'Q2', 'next 30 days', '2027-05'." },
        owner: { type: 'string', description: 'Limit to one owner. Optional.' },
      },
      required: ['when'],
    },
  },
  async run(input, ctx) {
    const supabase = createAdminClient()
    const range = resolveRange(str(input.when), ctx.today)
    if (!range) return { note: `I could not read "${str(input.when)}" as a time period. Try a month, a quarter, or "next 30 days".` }

    const { data, error } = await supabase
      .from('reproduction_events')
      .select('expected_calving_date, event_date, preg_check_result, breed_method, sire_name_text, animal_id, animals(tag_number, name, owner_id, status)')
      .not('expected_calving_date', 'is', null)
      .gte('expected_calving_date', range.start)
      .lte('expected_calving_date', range.end)
      .order('expected_calving_date')

    if (error) return { error: error.message }

    // Via `unknown`: PostgREST models the to-one animals join as an array.
    const rows = (data ?? []) as unknown as Array<{
      expected_calving_date: string; preg_check_result: string | null
      breed_method: string | null; sire_name_text: string | null
      animals: { tag_number: string; name: string | null; owner_id: string | null; status: string } | null
    }>

    let ownerId: string | null = null
    let ownerName = ''
    if (str(input.owner)) {
      const { match, candidates } = await matchOwner(supabase, str(input.owner))
      if (!match) {
        return candidates.length
          ? { due: [], note: `More than one owner matches "${str(input.owner)}"`, candidates: candidates.map(ownerLabel) }
          : { due: [], note: `No owner matches "${str(input.owner)}"` }
      }
      ownerId = match.id
      ownerName = ownerLabel(match)
    }

    // A sold or dead cow's old due date is not news.
    const live = rows.filter(r => r.animals && r.animals.status === 'active')
    const scoped = ownerId ? live.filter(r => r.animals?.owner_id === ownerId) : live

    return {
      period: range.label,
      owner: ownerName || undefined,
      count: scoped.length,
      due: scoped.map(r => ({
        tag:  r.animals?.tag_number,
        name: r.animals?.name || null,
        due:  r.expected_calving_date,
        preg_check: r.preg_check_result,
        bred_by: r.breed_method,
        sire: r.sire_name_text || null,
      })),
      note: scoped.length === 0 ? `Nothing is due in ${range.label}.` : undefined,
    }
  },
}

const ownerBill: RancherTool = {
  spec: {
    name: 'owner_bill',
    description:
      "What an owner owes for a quarter, as it stands right now. Use for 'how much is the expected bill " +
      "for Q3 for Andy Holloman'. Separates what has been invoiced from what is still pending, " +
      'because pending can still change.',
    input_schema: {
      type: 'object',
      properties: {
        owner:   { type: 'string', description: 'Owner name as the rancher said it.' },
        quarter: { type: 'number', description: '1-4. Defaults to the quarter we are in.' },
        year:    { type: 'number', description: 'Four digits. Defaults to this year.' },
      },
      required: ['owner'],
    },
  },
  async run(input, ctx) {
    const supabase = createAdminClient()
    const { match, candidates } = await matchOwner(supabase, str(input.owner))
    if (!match) {
      return candidates.length
        ? { note: `More than one owner matches "${str(input.owner)}"`, candidates: candidates.map(ownerLabel) }
        : { note: `No owner matches "${str(input.owner)}"` }
    }

    const todayMonth = Number(ctx.today.slice(5, 7))
    const quarter = num(input.quarter) ?? Math.floor((todayMonth - 1) / 3) + 1
    const year    = num(input.year)    ?? Number(ctx.today.slice(0, 4))

    const report = await buildAllocationReport(supabase, { quarter, year, ownerId: match.id })
    const summary = report.owners.find(o => o.owner_id === match.id)

    if (!summary) {
      return {
        owner: ownerLabel(match),
        period: `Q${quarter} ${year}`,
        note: `Nothing is allocated to ${ownerLabel(match)} for Q${quarter} ${year} yet.`,
      }
    }

    return {
      owner:  ownerLabel(match),
      period: `Q${quarter} ${year}`,
      pending:  money(summary.pending),
      invoiced: money(summary.invoiced),
      paid:     money(summary.paid),
      total:    money(summary.total),
      // The model should be able to say WHAT the bill is made of, not just how big.
      lines: report.rows
        .filter(r => r.owner_id === match.id)
        .map(r => ({
          date: r.expense_date,
          what: r.description,
          category: r.category_name,
          this_owners_share: money(r.amount),
          whole_expense: money(r.expense_total),
          how_split: r.share_note,
          status: r.status,
          invoice: r.invoice_number,
        })),
      caveat: summary.pending > 0
        ? 'Pending shares are calculated live and can still move as expenses are added or animals change hands.'
        : undefined,
    }
  },
}

const findContact: RancherTool = {
  spec: {
    name: 'find_contact',
    description:
      "Look up somebody the ranch calls — the AI technician, the vet, a hauler, the brand inspector. " +
      "Use for 'what is Spencer's phone number for AI'. Searches by name or by role.",
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Who they are looking for.' },
        role: { type: 'string', description: "Narrow by role, e.g. 'ai_tech', 'vet', 'hauler'." },
      },
    },
  },
  async run(input) {
    const supabase = createAdminClient()
    let q = supabase
      .from('ranch_contacts')
      .select('name, role, company, phone, email, notes')
      .eq('is_active', true)
      .order('name')
      .limit(25)

    if (str(input.name)) q = q.ilike('name', `%${str(input.name)}%`)
    if (str(input.role)) q = q.eq('role', str(input.role))

    const { data, error } = await q
    if (error) return { error: error.message }

    const rows = (data ?? []) as Array<Record<string, unknown>>
    if (rows.length === 0) {
      return {
        contacts: [],
        note: str(input.name)
          ? `Nobody called "${str(input.name)}" is saved in the ranch contacts. They can be added under Admin → Ranch.`
          : 'No contacts are saved yet.',
      }
    }
    return { count: rows.length, contacts: rows }
  },
}

const animalDetail: RancherTool = {
  spec: {
    name: 'animal_detail',
    description:
      'Everything about one animal by tag number: owner, breeding, last weight, recent health events, ' +
      'and whether it is inside a drug withdrawal period right now.',
    input_schema: {
      type: 'object',
      properties: { tag: { type: 'string', description: 'The tag number.' } },
      required: ['tag'],
    },
  },
  async run(input, ctx) {
    const supabase = createAdminClient()
    const tag = str(input.tag).replace(/^#/, '')

    const { data: animalRow } = await supabase
      .from('animals')
      .select('id, tag_number, name, sex, breed, dob, status, owner_id, ear_tag_color, cull_flagged_at, cull_reason, notes')
      .ilike('tag_number', tag)
      .maybeSingle()

    const animal = animalRow as Record<string, unknown> | null
    if (!animal) return { note: `No animal with tag ${tag}.` }

    const [owner, weights, health, repro] = await Promise.all([
      animal.owner_id
        ? supabase.from('grazing_owners').select('name, company_name, owner_name').eq('id', animal.owner_id as string).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('weights').select('weighed_at, weight_lbs').eq('animal_id', animal.id as string)
        .order('weighed_at', { ascending: false }).limit(3),
      supabase.from('health_events')
        .select('event_date, event_type, drug_name, withdrawal_clear_date, administered_by, notes')
        .eq('animal_id', animal.id as string).order('event_date', { ascending: false }).limit(5),
      supabase.from('reproduction_events')
        .select('event_date, event_type, preg_check_result, expected_calving_date, sire_name_text, breed_method')
        .eq('animal_id', animal.id as string).order('event_date', { ascending: false }).limit(5),
    ])

    const healthRows = (health.data ?? []) as Array<{ withdrawal_clear_date: string | null; drug_name: string | null }>
    const inWithdrawal = healthRows.filter(h => h.withdrawal_clear_date && h.withdrawal_clear_date > ctx.today)

    const o = owner.data as { name: string | null; company_name: string | null; owner_name: string | null } | null

    return {
      tag: animal.tag_number,
      name: animal.name || null,
      sex: animal.sex,
      breed: animal.breed,
      dob: animal.dob,
      status: animal.status,
      owner: o ? ownerLabel(o) : 'the home ranch',
      tag_color: animal.ear_tag_color,
      on_cull_list: Boolean(animal.cull_flagged_at),
      cull_reason: animal.cull_reason || null,
      weights: weights.data ?? [],
      recent_health: health.data ?? [],
      recent_breeding: repro.data ?? [],
      // Stated rather than implied. Selling an animal inside withdrawal is the
      // mistake this whole record exists to prevent.
      withdrawal: inWithdrawal.length
        ? { clear: false, until: inWithdrawal.map(h => `${h.drug_name} until ${h.withdrawal_clear_date}`) }
        : { clear: true },
    }
  },
}

const expenseSummary: RancherTool = {
  spec: {
    name: 'expense_summary',
    description:
      "What the ranch spent over a period, totalled by category. Use for 'what did I spend on hay this year', " +
      "'how much have I put into vet bills since January'.",
    input_schema: {
      type: 'object',
      properties: {
        when:     { type: 'string', description: "'Q3', 'May', '2026-05', 'next 30 days', or omit for this year." },
        category: { type: 'string', description: 'Narrow to one category, matched loosely.' },
      },
    },
  },
  async run(input, ctx) {
    const supabase = createAdminClient()
    const year = ctx.today.slice(0, 4)
    const range = str(input.when)
      ? resolveRange(str(input.when), ctx.today)
      : { start: `${year}-01-01`, end: `${year}-12-31`, label: year }

    if (!range) return { note: `I could not read "${str(input.when)}" as a time period.` }

    let q = supabase
      .from('lease_expenses')
      .select('category_name, description, total_amount, expense_date, vendor')
      .gte('expense_date', range.start)
      .lte('expense_date', range.end)
      .order('expense_date', { ascending: false })
      .limit(500)

    if (str(input.category)) q = q.ilike('category_name', `%${str(input.category)}%`)

    const { data, error } = await q
    if (error) return { error: error.message }

    const rows = (data ?? []) as Array<{ category_name: string | null; total_amount: number; description: string | null; expense_date: string; vendor: string | null }>
    const byCategory = new Map<string, number>()
    let total = 0
    for (const r of rows) {
      const amt = Number(r.total_amount) || 0
      total += amt
      const k = r.category_name || 'Uncategorised'
      byCategory.set(k, (byCategory.get(k) ?? 0) + amt)
    }

    return {
      period: range.label,
      total: money(total),
      count: rows.length,
      by_category: [...byCategory.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([category, amount]) => ({ category, amount: money(amount) })),
      largest: rows
        .slice()
        .sort((a, b) => (Number(b.total_amount) || 0) - (Number(a.total_amount) || 0))
        .slice(0, 5)
        .map(r => ({ date: r.expense_date, what: r.description, vendor: r.vendor, amount: money(Number(r.total_amount) || 0) })),
      note: rows.length === 0 ? `Nothing recorded in ${range.label}.` : undefined,
      truncated: rows.length === 500 ? 'Only the first 500 expenses were totalled.' : undefined,
    }
  },
}

const listReminders: RancherTool = {
  spec: {
    name: 'list_reminders',
    description: "What is coming up: preg checks, calvings, recheck dates. Use for 'what do I have coming up', 'what's due this week'.",
    input_schema: {
      type: 'object',
      properties: {
        when: { type: 'string', description: "Defaults to the next 30 days. Accepts 'next 7 days', 'May', 'Q3'." },
      },
    },
  },
  async run(input, ctx) {
    const supabase = createAdminClient()
    const range = resolveRange(str(input.when) || 'next 30 days', ctx.today)
    if (!range) return { note: `I could not read "${str(input.when)}" as a time period.` }

    const { data, error } = await supabase
      .from('reminders')
      .select('due_date, title, reminder_type, notes, animal_id, animals(tag_number, name)')
      .eq('is_dismissed', false)
      .gte('due_date', range.start)
      .lte('due_date', range.end)
      .order('due_date')
      .limit(100)

    if (error) return { error: error.message }

    const rows = (data ?? []) as unknown as Array<{
      due_date: string; title: string | null; reminder_type: string | null; notes: string | null
      animals: { tag_number: string; name: string | null } | null
    }>

    return {
      period: range.label,
      count: rows.length,
      reminders: rows.map(r => ({
        due: r.due_date,
        what: r.title || r.reminder_type,
        animal: r.animals ? `#${r.animals.tag_number}${r.animals.name ? ` (${r.animals.name})` : ''}` : null,
        notes: r.notes,
      })),
      note: rows.length === 0 ? `Nothing is due in ${range.label}.` : undefined,
    }
  },
}

const searchSires: RancherTool = {
  spec: {
    name: 'search_sires',
    description:
      'Search the ranch\'s own sire library — bulls already imported with their EPDs. ' +
      'Use this BEFORE searching the web when the rancher asks about a bull, because a bull ' +
      'they already own data on is the one they probably mean.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Bull name, registration number, or stud code.' } },
      required: ['query'],
    },
  },
  async run(input) {
    const supabase = createAdminClient()
    const term = str(input.query)
    const { data, error } = await supabase
      .from('sire_library')
      .select('*')
      .or(`name.ilike.%${term}%,registration_number.ilike.%${term}%`)
      .limit(5)

    if (error) return { error: error.message, note: 'The sire library could not be searched.' }
    const rows = (data ?? []) as Array<Record<string, unknown>>
    if (rows.length === 0) return { sires: [], note: `Nothing in the sire library matches "${term}". The web search tool may know him.` }

    // The library is 52 columns wide. Hand back what is not empty rather than
    // 47 nulls the model has to wade through.
    return {
      count: rows.length,
      sires: rows.map(r => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== null && v !== ''))),
    }
  },
}

// ─── Write tools ──────────────────────────────────────────────────────────────
//
// PROPOSE_ONLY: these do not write. Each validates what was asked, resolves the
// names into real ids, and hands back a proposal for the rancher to confirm.
// The confirmed proposal is what actually gets executed, by the caller.
//
// That split is deliberate and it is the whole safety story. Voice makes it
// non-negotiable: a misheard "twelve" for "twenty" has to be visible before it
// becomes a treatment record, and a treatment record sets a withdrawal date
// that decides whether an animal can be sold.

const proposeReminder: RancherTool = {
  spec: {
    name: 'propose_reminder',
    description:
      'Set up a reminder. Returns a proposal the rancher confirms before it is saved. ' +
      "Use for 'remind me to pull the bulls on August 15', 'remind me to recheck #42 in two weeks'.",
    input_schema: {
      type: 'object',
      properties: {
        title:    { type: 'string', description: 'What to be reminded of, in the rancher\'s own words.' },
        due_date: { type: 'string', description: 'YYYY-MM-DD. Work out relative dates like "in two weeks" yourself from today.' },
        tag:      { type: 'string', description: 'Attach it to an animal by tag number. Optional.' },
        notes:    { type: 'string' },
      },
      required: ['title', 'due_date'],
    },
  },
  async run(input) {
    const supabase = createAdminClient()
    const due = str(input.due_date)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return { error: `"${due}" is not a date I can use. Needs to be YYYY-MM-DD.` }

    let animalId: string | null = null
    let animalLabel: string | null = null
    if (str(input.tag)) {
      const { data } = await supabase.from('animals')
        .select('id, tag_number, name').ilike('tag_number', str(input.tag).replace(/^#/, '')).maybeSingle()
      const a = data as { id: string; tag_number: string; name: string | null } | null
      if (!a) return { error: `No animal with tag ${str(input.tag)}.` }
      animalId = a.id
      animalLabel = `#${a.tag_number}${a.name ? ` (${a.name})` : ''}`
    }

    return {
      proposal: {
        action: 'create_reminder',
        summary: `Remind you on ${due}: ${str(input.title)}${animalLabel ? ` — ${animalLabel}` : ''}`,
        payload: {
          title: str(input.title),
          due_date: due,
          animal_id: animalId,
          notes: str(input.notes) || null,
          reminder_type: 'manual',
        },
      },
      needs_confirmation: true,
    }
  },
}

const proposeExpense: RancherTool = {
  spec: {
    name: 'propose_expense',
    description:
      'Record an expense. Returns a proposal the rancher confirms before it is saved. ' +
      "Use for 'log 40 bales of hay, $2,400 from Miller Ranch'. " +
      'If the expense is shared across the herd it will be split across owners when it is saved.',
    input_schema: {
      type: 'object',
      properties: {
        description: { type: 'string' },
        amount:      { type: 'number', description: 'Total dollars, before any split.' },
        category:    { type: 'string', description: 'Matched against the ranch\'s expense categories.' },
        expense_date:{ type: 'string', description: 'YYYY-MM-DD. Defaults to today.' },
        vendor:      { type: 'string' },
        tag:         { type: 'string', description: 'If it belongs to one animal rather than the herd.' },
      },
      required: ['description', 'amount'],
    },
  },
  async run(input, ctx) {
    const supabase = createAdminClient()
    const amount = num(input.amount)
    if (amount === null || amount <= 0) return { error: 'An expense needs a dollar amount greater than zero.' }

    const date = str(input.expense_date) || ctx.today
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: `"${date}" is not a date I can use.` }

    const { data: cats } = await supabase.from('expense_categories').select('id, name').eq('is_active', true)
    const categories = (cats ?? []) as Array<{ id: string; name: string }>
    const wanted = str(input.category).toLowerCase()
    const cat = wanted
      ? categories.find(c => c.name.toLowerCase() === wanted) ?? categories.find(c => c.name.toLowerCase().includes(wanted))
      : null

    if (wanted && !cat) {
      return { error: `No expense category matches "${str(input.category)}".`, categories: categories.map(c => c.name) }
    }

    let animalId: string | null = null
    let animalLabel: string | null = null
    if (str(input.tag)) {
      const { data } = await supabase.from('animals')
        .select('id, tag_number, name').ilike('tag_number', str(input.tag).replace(/^#/, '')).maybeSingle()
      const a = data as { id: string; tag_number: string; name: string | null } | null
      if (!a) return { error: `No animal with tag ${str(input.tag)}.` }
      animalId = a.id
      animalLabel = `#${a.tag_number}${a.name ? ` (${a.name})` : ''}`
    }

    return {
      proposal: {
        action: 'create_expense',
        summary:
          `${money(amount)} — ${str(input.description)}` +
          `${cat ? ` (${cat.name})` : ''}${str(input.vendor) ? ` from ${str(input.vendor)}` : ''} on ${date}` +
          `${animalLabel ? `, charged to ${animalLabel}` : ', split across the herd'}`,
        payload: {
          description: str(input.description),
          total_amount: amount,
          category_id: cat?.id ?? null,
          category_name: cat?.name ?? null,
          expense_date: date,
          vendor: str(input.vendor) || null,
          animal_id: animalId,
        },
      },
      needs_confirmation: true,
      // Said out loud, because "it will be split" is a claim about somebody's bill.
      note: animalId
        ? 'This lands on one animal, so it goes to that animal\'s owner alone.'
        : 'With no animal attached this is a herd expense, split by head-days across every owner who had cattle here that period.',
    }
  },
}

const proposeTreatment: RancherTool = {
  spec: {
    name: 'propose_treatment',
    description:
      'Record a treatment on an animal. Returns a proposal the rancher confirms before it is saved. ' +
      "Use for 'gave #42 Draxxin today'. The withdrawal comes off the drug library, not from the rancher.",
    input_schema: {
      type: 'object',
      properties: {
        tag:        { type: 'string', description: 'Tag number of the animal treated.' },
        drug:       { type: 'string', description: 'Product name as they said it.' },
        dose_amount:{ type: 'number' },
        dose_unit:  { type: 'string', description: "e.g. 'mL', 'cc'." },
        event_date: { type: 'string', description: 'YYYY-MM-DD. Defaults to today.' },
        administered_by: { type: 'string' },
        notes:      { type: 'string' },
      },
      required: ['tag', 'drug'],
    },
  },
  async run(input, ctx) {
    const supabase = createAdminClient()
    const date = str(input.event_date) || ctx.today
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: `"${date}" is not a date I can use.` }

    const { data: animalRow } = await supabase.from('animals')
      .select('id, tag_number, name, status').ilike('tag_number', str(input.tag).replace(/^#/, '')).maybeSingle()
    const animal = animalRow as { id: string; tag_number: string; name: string | null; status: string } | null
    if (!animal) return { error: `No animal with tag ${str(input.tag)}.` }

    const term = str(input.drug)
    const { data: drugRows } = await supabase
      .from('drug_library')
      .select('id, brand_name, generic_name, withdrawal_days_meat, withdrawal_days_milk, route')
      .eq('is_active', true)
      .or(`brand_name.ilike.%${term}%,generic_name.ilike.%${term}%`)
      .limit(5)

    const drugs = (drugRows ?? []) as Array<{
      id: string; brand_name: string; generic_name: string | null
      withdrawal_days_meat: number | null; withdrawal_days_milk: number | null; route: string | null
    }>

    if (drugs.length === 0) {
      return { error: `"${term}" is not in the drug library. It can be added under Admin → Drug Library, with the withdrawal off the label.` }
    }
    if (drugs.length > 1) {
      const exact = drugs.filter(d => d.brand_name.toLowerCase() === term.toLowerCase())
      if (exact.length !== 1) {
        return { note: `More than one product matches "${term}".`, candidates: drugs.map(d => d.brand_name) }
      }
      drugs.splice(0, drugs.length, exact[0])
    }

    const drug = drugs[0]
    const meat = drug.withdrawal_days_meat ?? 0
    const clear = new Date(`${date}T00:00:00Z`)
    clear.setUTCDate(clear.getUTCDate() + meat)
    const clearDate = clear.toISOString().slice(0, 10)

    return {
      proposal: {
        action: 'create_treatment',
        summary:
          `${drug.brand_name} to #${animal.tag_number}${animal.name ? ` (${animal.name})` : ''} on ${date}` +
          `${num(input.dose_amount) ? `, ${num(input.dose_amount)} ${str(input.dose_unit) || 'mL'}` : ''}`,
        payload: {
          animal_id: animal.id,
          event_type: 'treatment',
          event_date: date,
          drug_name: drug.brand_name,
          dose_amount: num(input.dose_amount),
          dose_unit: str(input.dose_unit) || null,
          withdrawal_days: meat,
          withdrawal_clear_date: clearDate,
          administered_by: str(input.administered_by) || null,
          notes: str(input.notes) || null,
        },
      },
      needs_confirmation: true,
      // The number that matters, surfaced before the record exists rather than after.
      withdrawal: meat > 0
        ? `${meat} day meat withdrawal — #${animal.tag_number} cannot go to slaughter until ${clearDate}.`
        : 'This product carries no meat withdrawal.',
      warning: animal.status !== 'active' ? `#${animal.tag_number} is marked ${animal.status}, not active.` : undefined,
    }
  },
}

/**
 * Voice only. The tap-to-confirm card does not exist on a phone call, so a
 * spoken yes needs somewhere to land — otherwise voice can describe a job it
 * can never finish.
 *
 * Not in RANCHER_TOOLS: the text agent must never reach this, because on
 * screen the confirmation IS the button, and a model that can write without
 * one would make the button decorative.
 *
 * The safety is that this takes no arguments worth mishearing. It commits the
 * proposal already on the table, exactly as it was read back.
 */
export const confirmLastProposal: RancherTool = {
  spec: {
    name: 'confirm_last_proposal',
    description:
      'Save the proposal you just read out, after the rancher has said yes. ' +
      'Only call this when you have read the whole thing back and heard a clear yes. ' +
      'Anything less than a yes is a no — say you have left it alone.',
    input_schema: {
      type: 'object',
      properties: {
        heard: { type: 'string', description: 'What the rancher actually said, word for word.' },
      },
      required: ['heard'],
    },
  },
  async run() {
    // Executed by the voice webhook, which holds the proposal for the call.
    // Reaching this body means it was called outside that path.
    return { error: 'There is nothing waiting to be confirmed.' }
  },
}

export const RANCHER_TOOLS: RancherTool[] = [
  findAnimals,
  calvingSchedule,
  ownerBill,
  findContact,
  animalDetail,
  expenseSummary,
  listReminders,
  searchSires,
  proposeReminder,
  proposeExpense,
  proposeTreatment,
]

export const TOOLS_BY_NAME = new Map(RANCHER_TOOLS.map(t => [t.spec.name, t]))
