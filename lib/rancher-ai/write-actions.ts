import type Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Update } from '@/lib/supabase/admin'
import { asAnimalSex, asAnimalStatus } from '@/lib/db-enums'

/**
 * Everything RancherAI can change, as data.
 *
 * This file exists because the old shape did not scale. Each capability was a
 * hand-written tool in tools.ts PLUS a branch in executeProposal — two places,
 * two sets of validation, and the second one was where a check would quietly
 * go missing. Three actions cost about 240 lines that way. Eighteen would have
 * cost a thousand, most of it the same paragraph retyped.
 *
 * So an action declares itself once, here, and the machinery builds both ends:
 * tools.ts generates a `propose_*` tool from `input`, and executeProposal
 * dispatches to `execute`. Adding the nineteenth capability is an entry in a
 * list, not a new code path nobody reviews.
 *
 * ── The safety property that makes this acceptable ────────────────────────
 * Nothing here is reachable in one step. `prepare` resolves what the rancher
 * said into real ids and hands back a proposal; a human confirms it; only then
 * does `execute` run. That split is not ceremony — voice makes it structural,
 * because a misheard "twelve" for "twenty" has to be visible before it becomes
 * a treatment record that decides whether an animal can be sold.
 *
 * `execute` therefore re-validates everything. Its payload was built by a
 * model, travelled through a browser, and came back; it has exactly the same
 * trustworthiness as anything else that arrives over a wire, which is none.
 */

// ─── Kit ──────────────────────────────────────────────────────────────────────

export type ActionTier = 'operations' | 'billing_draft'

export interface ActionContext {
  authUserId: string
  /** Today in the ranch's timezone, YYYY-MM-DD. Actions never read the clock. */
  today: string
  /** Whoever is responsible. Reaches the change log through the client header. */
  actorName: string
  /**
   * The confirming request's own cookies, when it had any.
   *
   * An action that calls back into the app's API forwards these so the call
   * carries exactly the authority of the person who pressed confirm — no more,
   * and through the same gate their button press goes through. Absent on the
   * voice path, which has no browser session; actions that need it say so
   * rather than finding a way round it.
   */
  cookieHeader?: string | null
}

export type Prepared =
  | { summary: string; payload: Record<string, unknown> }
  | { error: string }

export type Executed =
  | { confirmation: string; table: string; rowId: string | null }
  | { error: string }

export interface WriteAction {
  /** Stable id. Stored on ai_writes and carried in the proposal. */
  name: string
  tier: ActionTier
  /** What the model reads to decide whether this is the right tool. */
  description: string
  input: Record<string, unknown>
  required: string[]
  prepare: (input: Record<string, unknown>, ctx: ActionContext) => Promise<Prepared>
  execute: (payload: Record<string, unknown>, ctx: ActionContext) => Promise<Executed>
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : null }
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const isUuid = (v: unknown) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const money = (n: number) => `$${n.toFixed(2)}`

const S  = (description: string) => ({ type: 'string', description })
const N  = (description: string) => ({ type: 'number', description })
const D  = (description: string) => ({ type: 'string', description: `${description} YYYY-MM-DD.` })
const EN = (values: readonly string[], description: string) =>
  ({ type: 'string', enum: [...values], description })

const TAG = S('Ear tag number, with or without the #.')

/** Every client an action writes with is named, so the change log has an actor. */
const db = (ctx: ActionContext) => createAdminClient(ctx.actorName)

/**
 * One animal from what the rancher called it.
 *
 * Exact tag first, then a name match. An ambiguous term returns the candidates
 * rather than picking one — writing to the wrong animal is the failure that
 * actually costs something, and it is silent.
 */
async function resolveAnimal(tag: string): Promise<
  | { animal: { id: string; tag_number: string; name: string | null; sex: string | null; status: string | null } }
  | { error: string }
> {
  const supabase = createAdminClient()
  const needle = tag.replace(/^#/, '').trim()
  if (!needle) return { error: 'Which animal?' }

  const { data } = await supabase
    .from('animals')
    .select('id, tag_number, name, sex, status')
    .or(`tag_number.ilike.${needle},name.ilike.%${needle}%`)
    .limit(6)

  const rows = (data ?? []) as Array<{
    id: string; tag_number: string; name: string | null; sex: string | null; status: string | null
  }>

  if (rows.length === 0) return { error: `No animal matching "${tag}".` }

  const exact = rows.filter(r => r.tag_number.toLowerCase() === needle.toLowerCase())
  if (exact.length === 1) return { animal: exact[0] }
  if (rows.length === 1)  return { animal: rows[0] }

  const list = rows.map(r => `#${r.tag_number}${r.name ? ` (${r.name})` : ''}`).join(', ')
  return { error: `"${tag}" matches more than one animal: ${list}. Which one?` }
}

const label = (a: { tag_number: string; name: string | null }) =>
  `#${a.tag_number}${a.name ? ` (${a.name})` : ''}`

/** Re-read the drug from the library at write time — see create_treatment. */
async function drugWithdrawal(brand: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('drug_library')
    .select('brand_name, withdrawal_days_meat')
    .ilike('brand_name', brand)
    .eq('is_active', true)
    .maybeSingle()
  return data as { brand_name: string; withdrawal_days_meat: number | null } | null
}

const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── Animals ──────────────────────────────────────────────────────────────────

/**
 * The editable surface of an animal record.
 *
 * Deliberately not all 55 columns. Money fields (purchase_price, ai_cost,
 * fmv_at_transfer) and lineage (dam_id, sire_id) are left out: they feed cost
 * basis and invoices, and a spoken sentence is the wrong instrument for
 * changing a number that lands on somebody's bill. Everything here is
 * descriptive, and every change to it is in the log either way.
 */
const ANIMAL_EDITABLE = {
  name:           S("The animal's name, or an empty string to clear it."),
  tag_number:     S('A new ear tag number.'),
  ear_tag_color:  S('Ear tag colour.'),
  breed:          S('Breed.'),
  dob:            D('Date of birth.'),
  sex:            EN(['bull', 'cow', 'steer', 'heifer', 'calf'], 'Sex.'),
  status:         EN(['active', 'sold', 'deceased', 'transferred', 'harvested'],
                     'Status. Prefer sell_animal or cull_animal where they fit.'),
  breeding_eligible: { type: 'boolean', description: 'Whether she is in the breeding herd.' },
  notes:          S('Notes. Replaces what is there.'),
} as const

const updateAnimal: WriteAction = {
  name: 'update_animal',
  tier: 'operations',
  description:
    'Change fields on an animal record — name, tag, breed, date of birth, sex, status, notes. ' +
    "Use for 'change 41's name to Lola', 'set #26 breed to Angus', '#7 is a steer now'. " +
    'Only pass the fields being changed.',
  input: { tag: TAG, ...ANIMAL_EDITABLE },
  required: ['tag'],

  async prepare(input, _ctx) {
    const found = await resolveAnimal(str(input.tag) ?? '')
    if ('error' in found) return { error: found.error }
    const a = found.animal

    const changes: Record<string, unknown> = {}
    for (const key of Object.keys(ANIMAL_EDITABLE)) {
      if (!(key in input) || input[key] === undefined || input[key] === null) continue
      const raw = input[key]

      if (key === 'dob') {
        if (!isDate(raw)) return { error: `"${raw}" is not a date I can use for date of birth.` }
        changes.dob = raw
      } else if (key === 'sex') {
        const v = asAnimalSex(str(raw) ?? '')
        if (!v) return { error: `"${raw}" is not a sex I know. Bull, cow, steer, heifer or calf.` }
        changes.sex = v
      } else if (key === 'status') {
        const v = asAnimalStatus(str(raw) ?? '')
        if (!v) return { error: `"${raw}" is not a status I know.` }
        changes.status = v
      } else if (key === 'breeding_eligible') {
        changes.breeding_eligible = Boolean(raw)
      } else if (key === 'name' || key === 'notes') {
        // An empty string is a real instruction here: clear the field.
        changes[key] = typeof raw === 'string' ? (raw.trim() || null) : null
      } else {
        const v = str(raw)
        if (v) changes[key] = v
      }
    }

    if (Object.keys(changes).length === 0) {
      return { error: `Nothing to change on ${label(a)}. What should be different?` }
    }

    const described = Object.entries(changes)
      .map(([k, v]) => `${k.replace(/_/g, ' ')} → ${v === null ? '(cleared)' : String(v)}`)
      .join(', ')

    return {
      summary: `Update ${label(a)}: ${described}`,
      payload: { animal_id: a.id, changes },
    }
  },

  async execute(payload, ctx) {
    const animalId = payload.animal_id
    if (!isUuid(animalId)) return { error: 'That animal reference is not valid' }

    const incoming = payload.changes
    if (!incoming || typeof incoming !== 'object') return { error: 'Nothing to change' }

    // Rebuilt from the allowlist rather than spread from the payload, so a key
    // that was never an editable field cannot arrive here and be written.
    const update: Update<'animals'> = {}
    for (const [k, v] of Object.entries(incoming as Record<string, unknown>)) {
      if (!(k in ANIMAL_EDITABLE)) return { error: `${k} is not a field I can change.` }
      if (k === 'dob' && v !== null && !isDate(v)) return { error: 'That date of birth is not valid' }
      if (k === 'sex'    && v !== null && !asAnimalSex(String(v)))    return { error: 'That sex is not valid' }
      if (k === 'status' && v !== null && !asAnimalStatus(String(v))) return { error: 'That status is not valid' }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(update as any)[k] = v
    }

    const { error } = await db(ctx).from('animals').update(update).eq('id', animalId as string)
    if (error) return { error: error.message }

    const n = Object.keys(update).length
    return {
      confirmation: `Updated — ${n} field${n === 1 ? '' : 's'} changed. It is in the animal's change log.`,
      table: 'animals',
      rowId: animalId as string,
    }
  },
}

const createAnimal: WriteAction = {
  name: 'create_animal',
  tier: 'operations',
  description:
    'Add a new animal to the herd. ' +
    "Use for 'add a new heifer, tag 62, born March 3', 'put a bull calf on the books for #41'.",
  input: {
    tag_number: S('Ear tag number for the new animal.'),
    sex:        EN(['bull', 'cow', 'steer', 'heifer', 'calf'], 'Sex.'),
    name:       S('Name. Optional.'),
    dob:        D('Date of birth. Optional.'),
    breed:      S('Breed. Optional.'),
    ear_tag_color: S('Ear tag colour. Optional.'),
    notes:      S('Notes. Optional.'),
  },
  required: ['tag_number', 'sex'],

  async prepare(input, _ctx) {
    const tag = str(input.tag_number)?.replace(/^#/, '')
    if (!tag) return { error: 'A new animal needs an ear tag number.' }

    const sex = asAnimalSex(str(input.sex) ?? '')
    if (!sex) return { error: 'A new animal needs a sex — bull, cow, steer, heifer or calf.' }

    const dob = input.dob == null ? null : (isDate(input.dob) ? (input.dob as string) : undefined)
    if (dob === undefined) return { error: `"${input.dob}" is not a date I can use.` }

    const supabase = createAdminClient()
    const { data: clash } = await supabase
      .from('animals').select('id, status').ilike('tag_number', tag).maybeSingle()
    if (clash) {
      return { error: `Tag ${tag} is already on the books (${(clash as { status: string }).status}). Pick another, or tell me to edit that one.` }
    }

    return {
      summary: `Add ${sex} #${tag}${str(input.name) ? ` (${str(input.name)})` : ''}` +
               `${dob ? `, born ${dob}` : ''}${str(input.breed) ? `, ${str(input.breed)}` : ''}`,
      payload: {
        tag_number: tag,
        sex,
        name: str(input.name),
        dob,
        breed: str(input.breed),
        ear_tag_color: str(input.ear_tag_color),
        notes: str(input.notes),
      },
    }
  },

  async execute(payload, ctx) {
    const tag = str(payload.tag_number)
    const sex = asAnimalSex(str(payload.sex) ?? '')
    if (!tag) return { error: 'A new animal needs an ear tag number' }
    if (!sex) return { error: 'A new animal needs a valid sex' }
    if (payload.dob != null && !isDate(payload.dob)) return { error: 'That date of birth is not valid' }

    const supabase = db(ctx)
    const { data: clash } = await supabase.from('animals').select('id').ilike('tag_number', tag).maybeSingle()
    if (clash) return { error: `Tag ${tag} is already taken` }

    const { data, error } = await supabase.from('animals').insert({
      tag_number: tag,
      sex,
      status: 'active',
      name:  str(payload.name),
      dob:   (payload.dob as string) ?? null,
      breed: str(payload.breed),
      ear_tag_color: str(payload.ear_tag_color),
      notes: str(payload.notes),
    }).select('id').single()

    if (error) return { error: error.message }
    return {
      confirmation: `Added #${tag} to the herd.`,
      table: 'animals',
      rowId: (data as { id: string }).id,
    }
  },
}

const recordWeight: WriteAction = {
  name: 'record_weight',
  tier: 'operations',
  description:
    "Record a weight on an animal. Use for '#41 weighed 1666 today', 'put 540 on the calf on 26 tag'.",
  input: {
    tag:         TAG,
    weight_lbs:  N('Weight in pounds.'),
    weighed_at:  D('Date weighed. Defaults to today.'),
    notes:       S('Notes. Optional.'),
  },
  required: ['tag', 'weight_lbs'],

  async prepare(input, ctx) {
    const found = await resolveAnimal(str(input.tag) ?? '')
    if ('error' in found) return { error: found.error }

    const lbs = num(input.weight_lbs)
    if (lbs === null || lbs <= 0)  return { error: 'A weight has to be a number over zero.' }
    // A cow is not 40 lb and not 4,000. A misheard number should stop here
    // rather than become a data point in an average daily gain.
    if (lbs < 20 || lbs > 3500)    return { error: `${lbs} lb does not look right for a bovine. Say it again?` }

    const when = input.weighed_at == null ? ctx.today : input.weighed_at
    if (!isDate(when)) return { error: `"${input.weighed_at}" is not a date I can use.` }

    return {
      summary: `${label(found.animal)} — ${lbs} lb on ${when}`,
      payload: { animal_id: found.animal.id, weight_lbs: lbs, weighed_at: when, notes: str(input.notes) },
    }
  },

  async execute(payload, ctx) {
    const lbs = num(payload.weight_lbs)
    if (!isUuid(payload.animal_id))       return { error: 'That animal reference is not valid' }
    if (lbs === null || lbs < 20 || lbs > 3500) return { error: 'That weight is not in a believable range' }
    if (!isDate(payload.weighed_at))      return { error: 'A weight needs a real date' }

    const { data, error } = await db(ctx).from('weights').insert({
      animal_id:  payload.animal_id as string,
      weight_lbs: lbs,
      weighed_at: payload.weighed_at as string,
      source:     'rancher_ai',
      notes:      str(payload.notes),
    }).select('id').single()

    if (error) return { error: error.message }
    return { confirmation: `Recorded — ${lbs} lb.`, table: 'weights', rowId: (data as { id: string }).id }
  },
}

const sellAnimal: WriteAction = {
  name: 'sell_animal',
  tier: 'operations',
  description:
    "Mark an animal sold. Use for 'sold #7 yesterday', 'mark 34 sold for 1850'. " +
    'Refuses while the animal is inside a drug withdrawal period.',
  input: {
    tag:        TAG,
    sale_date:  D('Date of sale. Defaults to today.'),
    sale_price: N('Sale price in dollars. Optional.'),
    buyer:      S('Who bought it. Optional.'),
    notes:      S('Notes. Optional.'),
  },
  required: ['tag'],

  async prepare(input, ctx) {
    const found = await resolveAnimal(str(input.tag) ?? '')
    if ('error' in found) return { error: found.error }
    const a = found.animal

    if (a.status !== 'active') return { error: `${label(a)} is already marked ${a.status}.` }

    const when = input.sale_date == null ? ctx.today : input.sale_date
    if (!isDate(when)) return { error: `"${input.sale_date}" is not a date I can use.` }

    const hold = await withdrawalHold(a.id, when as string)
    if (hold) return { error: hold }

    const price = num(input.sale_price)
    return {
      summary: `Sell ${label(a)} on ${when}` +
               `${price ? ` for ${money(price)}` : ''}${str(input.buyer) ? ` to ${str(input.buyer)}` : ''}`,
      payload: {
        animal_id: a.id, sale_date: when,
        sale_price: price, buyer: str(input.buyer), notes: str(input.notes),
      },
    }
  },

  async execute(payload, ctx) {
    if (!isUuid(payload.animal_id)) return { error: 'That animal reference is not valid' }
    if (!isDate(payload.sale_date)) return { error: 'A sale needs a real date' }

    // Re-checked at write time, not just at proposal time. A treatment can be
    // logged in the gap between the two, and this is the check that keeps meat
    // with a drug still in it off a truck.
    const hold = await withdrawalHold(payload.animal_id as string, payload.sale_date as string)
    if (hold) return { error: hold }

    const { error } = await db(ctx).from('animals').update({
      status: 'sold',
      disposition: 'sold',
      disposition_date: payload.sale_date as string,
      disposition_notes: str(payload.notes),
    }).eq('id', payload.animal_id as string)

    if (error) return { error: error.message }
    return {
      confirmation: `Marked sold on ${payload.sale_date}.` +
        (payload.sale_price ? ` Record the money against it in Sales when you get the ticket.` : ''),
      table: 'animals',
      rowId: payload.animal_id as string,
    }
  },
}

/** The one rule that outranks anything anybody says out loud. */
async function withdrawalHold(animalId: string, onDate: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('health_events')
    .select('drug_name, withdrawal_clear_date')
    .eq('animal_id', animalId)
    .not('withdrawal_clear_date', 'is', null)
    .gte('withdrawal_clear_date', onDate)
    .order('withdrawal_clear_date', { ascending: false })
    .limit(1)

  const row = (data ?? [])[0] as { drug_name: string | null; withdrawal_clear_date: string } | null
  if (!row) return null
  return `Not on ${onDate} — ${row.drug_name ?? 'a treatment'} holds it until ${row.withdrawal_clear_date}.`
}

const cullAnimal: WriteAction = {
  name: 'cull_animal',
  tier: 'operations',
  description:
    "Flag an animal for culling, with a reason. Does not remove it from the herd. " +
    "Use for 'put 46 on the cull list, open again', 'flag #12 for bad feet'.",
  input: { tag: TAG, reason: S('Why she is going.'), clear: { type: 'boolean', description: 'Pass true to take her back off the cull list.' } },
  required: ['tag'],

  async prepare(input, _ctx) {
    const found = await resolveAnimal(str(input.tag) ?? '')
    if ('error' in found) return { error: found.error }
    const a = found.animal

    if (input.clear === true) {
      return { summary: `Take ${label(a)} off the cull list`, payload: { animal_id: a.id, clear: true } }
    }
    const reason = str(input.reason)
    if (!reason) return { error: `Why is ${label(a)} going? A cull flag without a reason is no use in six months.` }

    return { summary: `Flag ${label(a)} for culling — ${reason}`, payload: { animal_id: a.id, reason } }
  },

  async execute(payload, ctx) {
    if (!isUuid(payload.animal_id)) return { error: 'That animal reference is not valid' }
    const clearing = payload.clear === true
    const reason = str(payload.reason)
    if (!clearing && !reason) return { error: 'A cull flag needs a reason' }

    const { error } = await db(ctx).from('animals').update(
      clearing
        ? { cull_flagged_at: null, cull_reason: null }
        : { cull_flagged_at: new Date().toISOString(), cull_reason: reason },
    ).eq('id', payload.animal_id as string)

    if (error) return { error: error.message }
    return {
      confirmation: clearing ? 'Taken off the cull list.' : `Flagged — ${reason}.`,
      table: 'animals',
      rowId: payload.animal_id as string,
    }
  },
}

// ─── Health ───────────────────────────────────────────────────────────────────

const createTreatment: WriteAction = {
  name: 'create_treatment',
  tier: 'operations',
  description:
    'Record a drug treatment on an animal. The withdrawal period is worked out from the drug library, ' +
    "not from what anyone says. Use for 'gave 41 12cc of Draxxin today'.",
  input: {
    tag:        TAG,
    drug_name:  S('Product given, as it appears in the drug library.'),
    event_date: D('Date given. Defaults to today.'),
    dose_amount: N('Dose amount. Optional.'),
    dose_unit:   S('Dose unit, e.g. cc or ml. Optional.'),
    administered_by: S('Who gave it. Defaults to whoever is asking.'),
    notes:      S('Notes. Optional.'),
  },
  required: ['tag', 'drug_name'],

  async prepare(input, ctx) {
    const found = await resolveAnimal(str(input.tag) ?? '')
    if ('error' in found) return { error: found.error }

    const brand = str(input.drug_name)
    if (!brand) return { error: 'Which product?' }
    const drug = await drugWithdrawal(brand)
    if (!drug) return { error: `"${brand}" is not in the drug library. Add it there first.` }

    const when = input.event_date == null ? ctx.today : input.event_date
    if (!isDate(when)) return { error: `"${input.event_date}" is not a date I can use.` }

    const days = drug.withdrawal_days_meat ?? 0
    return {
      summary: `${drug.brand_name} on ${label(found.animal)}, ${when}` +
               `${num(input.dose_amount) ? ` — ${num(input.dose_amount)}${str(input.dose_unit) ?? ''}` : ''}` +
               `${days ? ` · ${days} day withdrawal, clear ${addDays(when as string, days)}` : ''}`,
      payload: {
        animal_id: found.animal.id,
        drug_name: drug.brand_name,
        event_date: when,
        dose_amount: num(input.dose_amount),
        dose_unit: str(input.dose_unit),
        administered_by: str(input.administered_by),
        notes: str(input.notes),
      },
    }
  },

  async execute(payload, ctx) {
    const brand = str(payload.drug_name)
    if (!isUuid(payload.animal_id)) return { error: 'That animal reference is not valid' }
    if (!brand)                     return { error: 'A treatment needs a product' }
    if (!isDate(payload.event_date)) return { error: 'A treatment needs a real date' }

    // Re-derived from the library rather than trusted from the payload. This
    // number decides whether an animal can be sold, and it is the one nobody
    // should be able to talk the app out of — least of all over a phone.
    const drug = await drugWithdrawal(brand)
    if (!drug) return { error: `"${brand}" is not in the drug library any more.` }

    const days = drug.withdrawal_days_meat ?? 0
    const clearDate = addDays(payload.event_date as string, days)

    const { data, error } = await db(ctx).from('health_events').insert({
      animal_id: payload.animal_id as string,
      event_type: 'treatment',
      event_date: payload.event_date as string,
      drug_name: drug.brand_name,
      dose_amount: num(payload.dose_amount),
      dose_unit: str(payload.dose_unit),
      withdrawal_days: days,
      withdrawal_clear_date: clearDate,
      administered_by: str(payload.administered_by) ?? ctx.actorName,
      notes: str(payload.notes),
    }).select('id').single()

    if (error) return { error: error.message }
    return {
      confirmation: days > 0
        ? `Recorded. ${days} day meat withdrawal — clear on ${clearDate}.`
        : 'Recorded. No meat withdrawal on that one.',
      table: 'health_events',
      rowId: (data as { id: string }).id,
    }
  },
}

const createHealthEvent: WriteAction = {
  name: 'create_health_event',
  tier: 'operations',
  description:
    'Record a health event that is not a drug treatment — a vaccination, a vet visit, an illness, ' +
    "or a body condition score. Use for 'vet looked at 26 today', 'scored 41 a 5'.",
  input: {
    tag:        TAG,
    event_type: EN(['vaccine', 'vet_visit', 'illness', 'bcs_log'], 'What kind of event.'),
    event_date: D('Date. Defaults to today.'),
    bcs_score:  N('Body condition score 1-9. Only for bcs_log.'),
    notes:      S('What happened.'),
  },
  required: ['tag', 'event_type'],

  async prepare(input, ctx) {
    const found = await resolveAnimal(str(input.tag) ?? '')
    if ('error' in found) return { error: found.error }

    const kind = str(input.event_type)
    if (!kind || !['vaccine', 'vet_visit', 'illness', 'bcs_log'].includes(kind)) {
      return { error: 'That is not a health event type I know. For a drug, use a treatment instead.' }
    }

    const when = input.event_date == null ? ctx.today : input.event_date
    if (!isDate(when)) return { error: `"${input.event_date}" is not a date I can use.` }

    const bcs = num(input.bcs_score)
    if (kind === 'bcs_log' && (bcs === null || bcs < 1 || bcs > 9)) {
      return { error: 'A body condition score runs 1 to 9.' }
    }

    return {
      summary: `${kind.replace(/_/g, ' ')} on ${label(found.animal)}, ${when}` +
               `${bcs !== null ? ` — BCS ${bcs}` : ''}${str(input.notes) ? ` — ${str(input.notes)}` : ''}`,
      payload: {
        animal_id: found.animal.id, event_type: kind, event_date: when,
        bcs_score: kind === 'bcs_log' ? bcs : null, notes: str(input.notes),
      },
    }
  },

  async execute(payload, ctx) {
    const kind = str(payload.event_type)
    if (!isUuid(payload.animal_id)) return { error: 'That animal reference is not valid' }
    if (!kind || !['vaccine', 'vet_visit', 'illness', 'bcs_log'].includes(kind)) {
      return { error: 'That is not a health event type I know' }
    }
    if (!isDate(payload.event_date)) return { error: 'A health event needs a real date' }

    const { data, error } = await db(ctx).from('health_events').insert({
      animal_id: payload.animal_id as string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      event_type: kind as any,
      event_date: payload.event_date as string,
      bcs_score: num(payload.bcs_score),
      administered_by: ctx.actorName,
      notes: str(payload.notes),
    }).select('id').single()

    if (error) return { error: error.message }
    return { confirmation: 'Recorded.', table: 'health_events', rowId: (data as { id: string }).id }
  },
}

// ─── Reproduction ─────────────────────────────────────────────────────────────

const GESTATION_DAYS = 283

const recordBreeding: WriteAction = {
  name: 'record_breeding',
  tier: 'operations',
  description:
    "Record that a cow was bred, by AI or by a bull. Sets the expected calving date 283 days out " +
    "and a preg-check reminder. Use for 'bred 41 to Hot Lava on the 14th'.",
  input: {
    tag:          TAG,
    event_date:   D('Date bred. Defaults to today.'),
    breed_method: EN(['ai', 'natural'], 'AI or natural service.'),
    sire_name:    S('Bull or semen sire, by name. Optional.'),
    notes:        S('Notes. Optional.'),
  },
  required: ['tag'],

  async prepare(input, ctx) {
    const found = await resolveAnimal(str(input.tag) ?? '')
    if ('error' in found) return { error: found.error }
    const a = found.animal

    if (a.sex && !['cow', 'heifer'].includes(a.sex)) {
      return { error: `${label(a)} is a ${a.sex}. Did you mean a different animal?` }
    }

    const when = input.event_date == null ? ctx.today : input.event_date
    if (!isDate(when)) return { error: `"${input.event_date}" is not a date I can use.` }

    const method = str(input.breed_method) === 'natural' ? 'natural' : 'ai'
    const due = addDays(when as string, GESTATION_DAYS)

    return {
      summary: `Bred ${label(a)} on ${when} by ${method === 'ai' ? 'AI' : 'natural service'}` +
               `${str(input.sire_name) ? ` to ${str(input.sire_name)}` : ''} — due ${due}`,
      payload: {
        animal_id: a.id, event_date: when, breed_method: method,
        sire_name_text: str(input.sire_name), expected_calving_date: due, notes: str(input.notes),
      },
    }
  },

  async execute(payload, ctx) {
    if (!isUuid(payload.animal_id))  return { error: 'That animal reference is not valid' }
    if (!isDate(payload.event_date)) return { error: 'A breeding needs a real date' }

    const supabase = db(ctx)
    const due = addDays(payload.event_date as string, GESTATION_DAYS)

    const { data, error } = await supabase.from('reproduction_events').insert({
      animal_id: payload.animal_id as string,
      event_type: 'bred',
      event_date: payload.event_date as string,
      breed_method: str(payload.breed_method) === 'natural' ? 'natural' : 'ai',
      sire_name_text: str(payload.sire_name_text),
      expected_calving_date: due,
      notes: str(payload.notes),
    }).select('id').single()

    if (error) return { error: error.message }

    // The preg check is the point of recording the breeding. Logging the event
    // without it is how a cow gets bred and never looked at again.
    await supabase.from('reminders').insert({
      animal_id: payload.animal_id as string,
      reminder_type: 'preg_check',
      due_date: addDays(payload.event_date as string, 45),
      title: 'Preg check',
      reproduction_event_id: (data as { id: string }).id,
      is_dismissed: false,
    })

    return {
      confirmation: `Recorded. Due ${due}, preg check reminder set for 45 days out.`,
      table: 'reproduction_events',
      rowId: (data as { id: string }).id,
    }
  },
}

const recordPregCheck: WriteAction = {
  name: 'record_preg_check',
  tier: 'operations',
  description:
    "Record the result of a pregnancy check. Use for '41 is bred', '26 came up open'. " +
    'A confirmed result sets the calving reminder; an open one clears the outstanding preg-check reminder.',
  input: {
    tag:        TAG,
    result:     EN(['confirmed', 'open', 'recheck'], 'Result of the check.'),
    event_date: D('Date checked. Defaults to today.'),
    notes:      S('Notes. Optional.'),
  },
  required: ['tag', 'result'],

  async prepare(input, ctx) {
    const found = await resolveAnimal(str(input.tag) ?? '')
    if ('error' in found) return { error: found.error }

    const result = str(input.result)
    if (!result || !['confirmed', 'open', 'recheck'].includes(result)) {
      return { error: 'Confirmed, open or recheck?' }
    }

    const when = input.event_date == null ? ctx.today : input.event_date
    if (!isDate(when)) return { error: `"${input.event_date}" is not a date I can use.` }

    return {
      summary: `${label(found.animal)} — ${result} on ${when}`,
      payload: { animal_id: found.animal.id, result, event_date: when, notes: str(input.notes) },
    }
  },

  async execute(payload, ctx) {
    const result = str(payload.result)
    if (!isUuid(payload.animal_id)) return { error: 'That animal reference is not valid' }
    if (!result || !['confirmed', 'open', 'recheck'].includes(result)) return { error: 'That result is not valid' }
    if (!isDate(payload.event_date)) return { error: 'A preg check needs a real date' }

    const supabase = db(ctx)
    const animalId = payload.animal_id as string

    // The breeding this check belongs to, for its expected calving date.
    const { data: bredRow } = await supabase
      .from('reproduction_events')
      .select('id, event_date, expected_calving_date')
      .eq('animal_id', animalId).eq('event_type', 'bred')
      .order('event_date', { ascending: false }).limit(1).maybeSingle()

    const bred = bredRow as { id: string; event_date: string | null; expected_calving_date: string | null } | null
    const due = bred?.expected_calving_date
      ?? (bred?.event_date ? addDays(bred.event_date, GESTATION_DAYS) : null)

    const { data, error } = await supabase.from('reproduction_events').insert({
      animal_id: animalId,
      event_type: 'preg_check',
      event_date: payload.event_date as string,
      preg_check_result: result,
      expected_calving_date: result === 'confirmed' ? due : null,
      notes: str(payload.notes),
    }).select('id').single()

    if (error) return { error: error.message }

    // Close the preg-check reminder either way — it has been answered.
    await supabase.from('reminders')
      .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
      .eq('animal_id', animalId).eq('reminder_type', 'preg_check').eq('is_dismissed', false)

    if (result === 'confirmed' && due) {
      await supabase.from('reminders').insert({
        animal_id: animalId, reminder_type: 'calving', due_date: due,
        title: 'Calving due', reproduction_event_id: (data as { id: string }).id, is_dismissed: false,
      })
    }

    return {
      confirmation: result === 'confirmed'
        ? `Confirmed bred${due ? ` — calving reminder set for ${due}` : ''}.`
        : result === 'open' ? 'Recorded open.' : 'Recorded for recheck.',
      table: 'reproduction_events',
      rowId: (data as { id: string }).id,
    }
  },
}

const recordCalving: WriteAction = {
  name: 'record_calving',
  tier: 'operations',
  description:
    "Record that a cow calved. Optionally adds the calf to the herd at the same time. " +
    "Use for '41 calved this morning, bull calf, tag 63'.",
  input: {
    tag:          TAG,
    event_date:   D('Date calved. Defaults to today.'),
    calf_tag:     S('Ear tag for the new calf. Optional — leave it out to record the calving only.'),
    calf_sex:     EN(['bull', 'heifer'], 'Calf sex. Needed if a calf tag is given.'),
    birth_weight_lbs: N('Birth weight. Optional.'),
    calving_ease_score: N('Calving ease 1-5. Optional.'),
    notes:        S('Notes. Optional.'),
  },
  required: ['tag'],

  async prepare(input, ctx) {
    const found = await resolveAnimal(str(input.tag) ?? '')
    if ('error' in found) return { error: found.error }

    const when = input.event_date == null ? ctx.today : input.event_date
    if (!isDate(when)) return { error: `"${input.event_date}" is not a date I can use.` }

    const calfTag = str(input.calf_tag)?.replace(/^#/, '') ?? null
    let calfSex: string | null = null

    if (calfTag) {
      calfSex = str(input.calf_sex)
      if (!calfSex || !['bull', 'heifer'].includes(calfSex)) {
        return { error: `Is #${calfTag} a bull calf or a heifer calf?` }
      }
      const supabase = createAdminClient()
      const { data: clash } = await supabase.from('animals').select('id').ilike('tag_number', calfTag).maybeSingle()
      if (clash) return { error: `Tag ${calfTag} is already on the books.` }
    }

    return {
      summary: `${label(found.animal)} calved ${when}` +
               `${calfTag ? ` — ${calfSex} calf tagged #${calfTag}` : ' (calving only, no calf record)'}`,
      payload: {
        animal_id: found.animal.id, event_date: when,
        calf_tag: calfTag, calf_sex: calfSex,
        birth_weight_lbs: num(input.birth_weight_lbs),
        calving_ease_score: num(input.calving_ease_score),
        notes: str(input.notes),
      },
    }
  },

  async execute(payload, ctx) {
    if (!isUuid(payload.animal_id))  return { error: 'That animal reference is not valid' }
    if (!isDate(payload.event_date)) return { error: 'A calving needs a real date' }

    const supabase = db(ctx)
    const damId = payload.animal_id as string
    const calfTag = str(payload.calf_tag)
    let calfId: string | null = null

    if (calfTag) {
      const calfSex = str(payload.calf_sex)
      if (!calfSex || !['bull', 'heifer'].includes(calfSex)) return { error: 'A calf needs a sex' }

      const { data: clash } = await supabase.from('animals').select('id').ilike('tag_number', calfTag).maybeSingle()
      if (clash) return { error: `Tag ${calfTag} is already taken` }

      const { data: calf, error: calfErr } = await supabase.from('animals').insert({
        tag_number: calfTag,
        sex: 'calf',
        calf_sex: calfSex,
        status: 'active',
        dob: payload.event_date as string,
        dam_id: damId,
        birth_weight_lbs: num(payload.birth_weight_lbs),
        age_class: 'calf',
      }).select('id').single()

      if (calfErr) return { error: calfErr.message }
      calfId = (calf as { id: string }).id
    }

    const { data, error } = await supabase.from('reproduction_events').insert({
      animal_id: damId,
      event_type: 'calved',
      event_date: payload.event_date as string,
      calf_id: calfId,
      calving_ease_score: num(payload.calving_ease_score),
      notes: str(payload.notes),
    }).select('id').single()

    if (error) return { error: error.message }

    await supabase.from('reminders')
      .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
      .eq('animal_id', damId).eq('reminder_type', 'calving').eq('is_dismissed', false)

    return {
      confirmation: calfTag ? `Recorded — calf #${calfTag} is on the books.` : 'Calving recorded.',
      table: 'reproduction_events',
      rowId: (data as { id: string }).id,
    }
  },
}

const recordWeaning: WriteAction = {
  name: 'record_weaning',
  tier: 'operations',
  description: "Record a calf weaned, with its weaning weight. Use for 'weaned 63 at 540 today'.",
  input: {
    tag: TAG,
    event_date: D('Date weaned. Defaults to today.'),
    weaning_weight_lbs: N('Weaning weight in pounds. Optional.'),
    notes: S('Notes. Optional.'),
  },
  required: ['tag'],

  async prepare(input, ctx) {
    const found = await resolveAnimal(str(input.tag) ?? '')
    if ('error' in found) return { error: found.error }

    const when = input.event_date == null ? ctx.today : input.event_date
    if (!isDate(when)) return { error: `"${input.event_date}" is not a date I can use.` }

    const lbs = num(input.weaning_weight_lbs)
    if (lbs !== null && (lbs < 20 || lbs > 1500)) return { error: `${lbs} lb does not look right for a weaning weight.` }

    return {
      summary: `Weaned ${label(found.animal)} on ${when}${lbs ? ` at ${lbs} lb` : ''}`,
      payload: { animal_id: found.animal.id, event_date: when, weaning_weight_lbs: lbs, notes: str(input.notes) },
    }
  },

  async execute(payload, ctx) {
    if (!isUuid(payload.animal_id))  return { error: 'That animal reference is not valid' }
    if (!isDate(payload.event_date)) return { error: 'A weaning needs a real date' }
    const lbs = num(payload.weaning_weight_lbs)
    if (lbs !== null && (lbs < 20 || lbs > 1500)) return { error: 'That weaning weight is not in a believable range' }

    const supabase = db(ctx)
    const { data, error } = await supabase.from('reproduction_events').insert({
      animal_id: payload.animal_id as string,
      event_type: 'weaned',
      event_date: payload.event_date as string,
      weaning_date: payload.event_date as string,
      weaning_weight_lbs: lbs,
      notes: str(payload.notes),
    }).select('id').single()

    if (error) return { error: error.message }

    // The weaning weight belongs on the animal too — the performance reports
    // read it from there, not from the event.
    await supabase.from('animals').update({
      weaning_date: payload.event_date as string,
      weaning_weight_lbs: lbs,
    }).eq('id', payload.animal_id as string)

    return { confirmation: 'Weaning recorded.', table: 'reproduction_events', rowId: (data as { id: string }).id }
  },
}

// ─── Reminders and expenses ───────────────────────────────────────────────────

const createReminder: WriteAction = {
  name: 'create_reminder',
  tier: 'operations',
  description:
    "Set a reminder. Use for 'remind me to pull the bulls on August 15', 'recheck #42 in two weeks'.",
  input: {
    title:    S("What to be reminded of, in the rancher's own words."),
    due_date: D('When. Work out relative dates like "in two weeks" yourself from today.'),
    tag:      S('Attach it to an animal by tag number. Optional.'),
    notes:    S('Notes. Optional.'),
  },
  required: ['title', 'due_date'],

  async prepare(input, _ctx) {
    const due = input.due_date
    if (!isDate(due)) return { error: `"${due}" is not a date I can use. Needs to be YYYY-MM-DD.` }
    const title = str(input.title)
    if (!title) return { error: 'What should the reminder say?' }

    let animalId: string | null = null
    let animalLabel: string | null = null
    if (str(input.tag)) {
      const found = await resolveAnimal(str(input.tag) ?? '')
      if ('error' in found) return { error: found.error }
      animalId = found.animal.id
      animalLabel = label(found.animal)
    }

    return {
      summary: `Remind you on ${due}: ${title}${animalLabel ? ` — ${animalLabel}` : ''}`,
      payload: { title, due_date: due, animal_id: animalId, notes: str(input.notes) },
    }
  },

  async execute(payload, ctx) {
    const title = str(payload.title)
    if (!title)                     return { error: 'A reminder needs something to remind you of' }
    if (!isDate(payload.due_date))  return { error: 'A reminder needs a real date' }
    if (payload.animal_id != null && !isUuid(payload.animal_id)) {
      return { error: 'That animal reference is not valid' }
    }

    const { data, error } = await db(ctx).from('reminders').insert({
      title,
      due_date: payload.due_date as string,
      animal_id: (payload.animal_id as string) ?? null,
      notes: str(payload.notes),
      reminder_type: 'manual',
      is_dismissed: false,
    }).select('id').single()

    if (error) return { error: error.message }
    return { confirmation: `Set. You'll see it on ${payload.due_date}.`, table: 'reminders', rowId: (data as { id: string }).id }
  },
}

const dismissReminder: WriteAction = {
  name: 'dismiss_reminder',
  tier: 'operations',
  description: "Clear a reminder that has been dealt with. Use for 'I pulled the bulls, clear that reminder'.",
  input: { reminder_id: S('The id of the reminder, from list_reminders.') },
  required: ['reminder_id'],

  async prepare(input, _ctx) {
    const id = str(input.reminder_id)
    if (!isUuid(id)) return { error: 'Which reminder? Look them up first.' }

    const supabase = createAdminClient()
    const { data } = await supabase.from('reminders')
      .select('id, title, due_date, is_dismissed').eq('id', id as string).maybeSingle()
    const r = data as { id: string; title: string | null; due_date: string; is_dismissed: boolean } | null
    if (!r)              return { error: 'No reminder with that id.' }
    if (r.is_dismissed)  return { error: 'That one is already cleared.' }

    return { summary: `Clear reminder: ${r.title ?? 'reminder'} (${r.due_date})`, payload: { reminder_id: r.id } }
  },

  async execute(payload, ctx) {
    if (!isUuid(payload.reminder_id)) return { error: 'That reminder reference is not valid' }
    const { error } = await db(ctx).from('reminders')
      .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
      .eq('id', payload.reminder_id as string)
    if (error) return { error: error.message }
    return { confirmation: 'Cleared.', table: 'reminders', rowId: payload.reminder_id as string }
  },
}

const createExpense: WriteAction = {
  name: 'create_expense',
  tier: 'operations',
  description:
    "Record an expense. Use for 'bought 250 dollars of hay from Rockin B today'. " +
    'A herd expense is split across owners when the quarter is billed.',
  input: {
    description:  S('What it was for.'),
    total_amount: N('Amount in dollars.'),
    expense_date: D('Date. Defaults to today.'),
    vendor:       S('Who it was bought from. Optional.'),
    category:     S('Expense category by name, e.g. "Hay / Forage". Optional.'),
    tag:          S('Attach to one animal by tag, making it that owner\'s cost alone. Optional.'),
  },
  required: ['description', 'total_amount'],

  async prepare(input, ctx) {
    const description = str(input.description)
    const amount = num(input.total_amount)
    if (!description)                  return { error: 'What was the expense for?' }
    if (amount === null || amount <= 0) return { error: 'An expense needs an amount over zero.' }

    const when = input.expense_date == null ? ctx.today : input.expense_date
    if (!isDate(when)) return { error: `"${input.expense_date}" is not a date I can use.` }

    const supabase = createAdminClient()
    let categoryId: string | null = null
    let categoryName = 'Uncategorised'
    if (str(input.category)) {
      const { data } = await supabase.from('expense_categories')
        .select('id, name').ilike('name', `%${str(input.category)}%`).limit(2)
      const cats = (data ?? []) as Array<{ id: string; name: string }>
      if (cats.length === 1) { categoryId = cats[0].id; categoryName = cats[0].name }
      else if (cats.length > 1) {
        return { error: `"${str(input.category)}" matches ${cats.map(c => c.name).join(' and ')}. Which?` }
      }
    }

    let animalId: string | null = null
    let animalLabel: string | null = null
    if (str(input.tag)) {
      const found = await resolveAnimal(str(input.tag) ?? '')
      if ('error' in found) return { error: found.error }
      animalId = found.animal.id
      animalLabel = label(found.animal)
    }

    return {
      summary: `${description} — ${money(amount)} on ${when}` +
               `${str(input.vendor) ? ` from ${str(input.vendor)}` : ''}` +
               `${animalLabel ? ` · ${animalLabel} only` : ' · split across the herd'}`,
      payload: {
        description, total_amount: amount, expense_date: when,
        vendor: str(input.vendor), category_id: categoryId, category_name: categoryName,
        animal_id: animalId,
      },
    }
  },

  async execute(payload, ctx) {
    const description = str(payload.description)
    const amount = num(payload.total_amount)
    if (!description)                   return { error: 'An expense needs a description' }
    if (amount === null || amount <= 0) return { error: 'An expense needs an amount over zero' }
    if (!isDate(payload.expense_date))  return { error: 'An expense needs a real date' }
    if (payload.category_id != null && !isUuid(payload.category_id)) return { error: 'That category is not valid' }
    if (payload.animal_id   != null && !isUuid(payload.animal_id))   return { error: 'That animal reference is not valid' }

    const when = payload.expense_date as string
    const { data, error } = await db(ctx).from('lease_expenses').insert({
      description,
      total_amount: amount,
      expense_date: when,
      year:    Number(when.slice(0, 4)) % 100,
      quarter: Math.floor(Number(when.slice(5, 7)) / 3.01) + 1,
      category_id:   (payload.category_id as string) ?? null,
      category_name: str(payload.category_name) ?? 'Uncategorised',
      vendor:        str(payload.vendor),
      animal_id:     (payload.animal_id as string) ?? null,
      expense_type:  payload.animal_id ? 'animal_specific' : 'shared',
    }).select('id').single()

    if (error) return { error: error.message }
    return {
      confirmation: `Recorded — ${money(amount)} on ${when}.` +
        (payload.animal_id ? '' : ' It will be split across owners when the quarter is billed.'),
      table: 'lease_expenses',
      rowId: (data as { id: string }).id,
    }
  },
}

// ─── Billing drafts ───────────────────────────────────────────────────────────
//
// These produce a DRAFT and stop. Nothing here sends an invoice, marks one
// paid, or reaches an owner — an invoice going out is a decision with a person
// on the other end of it, and the whole billing system was rebuilt around not
// being able to charge anyone twice. A draft you review is help; an invoice
// sent because a model misheard a quarter is the argument you said you never
// want to have.

const draftQuarterlyInvoice: WriteAction = {
  name: 'draft_quarterly_invoice',
  tier: 'billing_draft',
  description:
    'Build a DRAFT quarterly invoice for one owner — grazing for the coming quarter plus the last ' +
    "quarter's expense shares. It is left as a draft for the rancher to review and send. " +
    "Use for 'draft Andy's Q4 invoice'.",
  input: {
    owner:           S('Owner name.'),
    billing_quarter: N('Quarter of grazing being billed, 1-4.'),
    billing_year:    N('Two-digit year for the grazing quarter, e.g. 26.'),
    expense_quarter: N('Quarter of expenses being billed, 1-4.'),
    expense_year:    N('Two-digit year for the expense quarter, e.g. 26.'),
  },
  required: ['owner', 'billing_quarter', 'billing_year', 'expense_quarter', 'expense_year'],

  async prepare(input, _ctx) {
    const supabase = createAdminClient()
    const term = str(input.owner)
    if (!term) return { error: 'Which owner?' }

    const { data } = await supabase.from('grazing_owners')
      .select('id, name, company_name, owner_name, is_self').eq('is_self', false)
    const owners = (data ?? []) as Array<{
      id: string; name: string | null; company_name: string | null; owner_name: string | null
    }>
    const norm = (s: string) => s.toLowerCase().replace(/\band\b/g, '&').replace(/[^a-z0-9&]/g, '')
    const needle = norm(term)
    const hits = owners.filter(o =>
      [o.company_name, o.owner_name, o.name].filter(Boolean).some(f => norm(String(f)).includes(needle)))

    if (hits.length === 0) return { error: `No owner matching "${term}".` }
    if (hits.length > 1) {
      return { error: `"${term}" matches ${hits.map(o => o.company_name || o.owner_name || o.name).join(' and ')}. Which?` }
    }
    const owner = hits[0]
    const ownerName = owner.company_name || owner.owner_name || owner.name || 'owner'

    const bq = num(input.billing_quarter)
    const eq = num(input.expense_quarter)
    const by = num(input.billing_year)
    const ey = num(input.expense_year)
    if (bq === null || bq < 1 || bq > 4) return { error: 'The billing quarter has to be 1 to 4.' }
    if (eq === null || eq < 1 || eq > 4) return { error: 'The expense quarter has to be 1 to 4.' }
    if (by === null || ey === null)      return { error: 'I need both years.' }

    // The guard that refuses a second invoice for a quarter lives in the
    // database, but saying so here is better than proposing something that
    // will be rejected.
    const { data: existing } = await supabase.from('invoices')
      .select('invoice_number, status')
      .eq('owner_id', owner.id).eq('expense_quarter', eq).eq('expense_year', ey % 100)
      .neq('status', 'void').limit(1)
    const prior = (existing ?? [])[0] as { invoice_number: string; status: string } | undefined
    if (prior) {
      return { error: `${ownerName} was already invoiced for Q${eq} 20${ey % 100} expenses on ${prior.invoice_number} (${prior.status}).` }
    }

    return {
      summary: `Draft invoice for ${ownerName} — Q${bq} 20${by % 100} grazing + Q${eq} 20${ey % 100} expenses. ` +
               `Saved as a draft for you to review and send.`,
      payload: {
        owner_id: owner.id, owner_name: ownerName,
        billing_quarter: bq, billing_year: by % 100,
        expense_quarter: eq, expense_year: ey % 100,
      },
    }
  },

  async execute(payload, ctx) {
    if (!isUuid(payload.owner_id)) return { error: 'That owner reference is not valid' }

    // Goes through the app's own route so the invoice is built by exactly the
    // code a human's button press uses — numbering, allocations, the duplicate
    // guard and the single transaction. A second implementation here would be
    // a second set of billing rules, which is the one thing this system is not
    // allowed to have.
    //
    // It carries the confirming user's own cookie rather than any bypass, so
    // the route's gate applies unchanged and the AI has no authority of its
    // own. On the voice path there is no cookie and this stops — drafting an
    // invoice is worth being at a screen for.
    const base = process.env.NEXT_PUBLIC_APP_URL
    if (!base) return { error: 'The app URL is not configured, so I cannot build the invoice.' }
    if (!ctx.cookieHeader) {
      return { error: 'I can only draft an invoice from the app, not over the phone. Open Billing and ask me there.' }
    }

    const res = await fetch(`${base}/api/billing/generate-quarterly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: ctx.cookieHeader },
      body: JSON.stringify({
        owner_id:        payload.owner_id,
        billing_quarter: payload.billing_quarter,
        billing_year:    payload.billing_year,
        expense_quarter: payload.expense_quarter,
        expense_year:    payload.expense_year,
      }),
    })

    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { error: json.error ?? 'The invoice could not be built.' }

    const invoice = json.invoice as { id: string; invoice_number: string; total_amount: number } | undefined
    if (!invoice) return { error: 'The invoice came back empty.' }

    return {
      confirmation:
        `Draft ${invoice.invoice_number} for ${payload.owner_name} — ${money(Number(invoice.total_amount))}. ` +
        `It is sitting in Billing as a draft. Nothing has been sent.`,
      table: 'invoices',
      rowId: invoice.id,
    }
  },
}

// ─── The registry ─────────────────────────────────────────────────────────────

export const WRITE_ACTIONS: readonly WriteAction[] = [
  // Animals
  updateAnimal, createAnimal, recordWeight, sellAnimal, cullAnimal,
  // Health
  createTreatment, createHealthEvent,
  // Reproduction
  recordBreeding, recordPregCheck, recordCalving, recordWeaning,
  // Day to day
  createReminder, dismissReminder, createExpense,
  // Billing, drafts only
  draftQuarterlyInvoice,
]

const BY_NAME = new Map(WRITE_ACTIONS.map(a => [a.name, a]))

export function findWriteAction(name: string): WriteAction | undefined {
  return BY_NAME.get(name)
}

/** `propose_update_animal` etc. The prefix is what keeps the two halves apart. */
export const proposeToolName = (action: WriteAction) => `propose_${action.name}`

export function toolSpecFor(action: WriteAction): Anthropic.Tool {
  return {
    name: proposeToolName(action),
    description:
      `${action.description} ` +
      'Returns a proposal the rancher confirms before anything is saved.',
    input_schema: {
      type: 'object',
      properties: action.input,
      required: action.required,
    },
  }
}
