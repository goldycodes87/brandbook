export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { deriveReproStatus } from '@/lib/repro-status'

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function quarterOf(dateStr: string): { quarter: number; year: number } {
  const d = new Date(dateStr + 'T00:00:00')
  return {
    quarter: Math.ceil((d.getMonth() + 1) / 3),
    year:    d.getFullYear() % 100,
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  const {
    animal_id,
    event_date,
    conception_method    = 'natural',
    semen_inventory_id,
    sire_id,
    sire_library_id,
    sire_name_text,
    ai_technician,
    ai_cost:               aiCostInput,
    straw_cost:            strawCostInput,
    deduct_straw:          deductStraw = true,
    override               = false,
    original_straw_action,
    protocol_group_id,
    protocol_step,
    notes,
  } = body

  if (!animal_id)  return NextResponse.json({ error: 'animal_id required' },  { status: 400 })
  if (!event_date) return NextResponse.json({ error: 'event_date required' }, { status: 400 })

  const supabase = createAdminClient()

  // ── a. Read animal + ranch_settings + existing repro events ────────────────
  const [{ data: animal }, { data: ranch }, { data: existingEvents }] = await Promise.all([
    supabase.from('animals')
      .select('id, owner_id, sex, dob, breeding_eligible, ai_fee_per_head')
      .eq('id', animal_id).single(),
    supabase.from('ranch_settings')
      .select('ai_tech_fee_per_cow, ai_preg_check_days_out')
      .limit(1).maybeSingle(),
    supabase.from('reproduction_events')
      .select('id, event_type, event_date, preg_check_result, sire_name_text, sire_library_id, semen_inventory_id, expected_calving_date')
      .eq('animal_id', animal_id)
      .order('event_date', { ascending: false }),
  ])

  if (!animal) return NextResponse.json({ error: 'Animal not found' }, { status: 404 })

  const techFeeDefault   = ranch?.ai_tech_fee_per_cow    ?? 0
  const pregCheckDaysOut = ranch?.ai_preg_check_days_out ?? 45

  // ── b. Re-breed guard ──────────────────────────────────────────────────────
  const repro = deriveReproStatus(
    { sex: animal.sex, dob: animal.dob, breeding_eligible: animal.breeding_eligible },
    existingEvents ?? [],
  )

  if (!repro.breedable) {
    const overridableStatuses = ['bred', 'confirmed', 'recheck']
    const isOverridable = overridableStatuses.includes(repro.status)

    if (!override) {
      return NextResponse.json(
        {
          blocked:     true,
          overridable: isOverridable,
          blockReason: repro.blockReason,
          lastBred:    repro.lastBred,
        },
        { status: 409 },
      )
    }

    // override === true: delete original active event (cascade removes reminder + expenses)
    if (repro.lastBred?.eventId) {
      await supabase.from('reproduction_events').delete().eq('id', repro.lastBred.eventId)
      if (original_straw_action === 'return' && repro.lastBred.semenInventoryId) {
        await supabase.rpc('adjust_straw', {
          p_inventory_id: repro.lastBred.semenInventoryId,
          p_delta:        1,
        })
      }
    }
  }

  // ── c. Resolve AI cost / straw defaults ────────────────────────────────────
  let resolvedAiCost:    number | null = null
  let resolvedStrawCost: number | null = null

  if (conception_method === 'ai') {
    // Resolution order: explicit value sent with this breeding, then the
    // per-animal override set on the animal detail page, then the ranch
    // default from Settings. Nothing is hardcoded.
    const animalFeeOverride = animal.ai_fee_per_head != null ? Number(animal.ai_fee_per_head) : null
    resolvedAiCost = aiCostInput != null
      ? Number(aiCostInput)
      : (animalFeeOverride ?? (techFeeDefault || null))

    if (semen_inventory_id) {
      if (strawCostInput != null) {
        resolvedStrawCost = Number(strawCostInput)
      } else {
        const { data: inv } = await supabase
          .from('semen_inventory')
          .select('price_per_straw')
          .eq('id', semen_inventory_id)
          .maybeSingle()
        resolvedStrawCost = inv?.price_per_straw ?? null
      }
    }
  }

  // ── d. Insert reproduction_events 'bred' row ───────────────────────────────
  const { data: event, error: eventErr } = await supabase
    .from('reproduction_events')
    .insert({
      animal_id,
      event_type:             'bred',
      event_date,
      conception_method,
      sire_id:                sire_id          || null,
      sire_library_id:        sire_library_id  || null,
      sire_name_text:         sire_name_text   || null,
      ai_technician:          conception_method === 'ai' ? (ai_technician || null) : null,
      semen_inventory_id:     conception_method === 'ai' ? (semen_inventory_id || null) : null,
      ai_cost:                conception_method === 'ai' ? resolvedAiCost    : null,
      straw_cost:             conception_method === 'ai' ? resolvedStrawCost : null,
      expected_calving_date:  addDays(event_date, 283),
      protocol_group_id:      protocol_group_id || null,
      protocol_step:          protocol_step     || null,
      notes:                  notes || null,
    })
    .select()
    .single()

  if (eventErr) return NextResponse.json({ error: eventErr.message }, { status: 500 })

  const eventId = event.id
  let newStrawCount: number | null = null
  let strawShort = false
  const expenseIds: string[] = []
  let reminderId: string | null = null

  // ── e. Deduct straw (non-fatal) ────────────────────────────────────────────
  if (conception_method === 'ai' && semen_inventory_id && deductStraw) {
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('adjust_straw', {
        p_inventory_id: semen_inventory_id,
        p_delta:        -1,
      })
      if (rpcErr) {
        strawShort = true
      } else {
        newStrawCount = rpcData as number
      }
    } catch {
      strawShort = true
    }
  }

  // ── f. Create owner_specific lease_expenses for AI ─────────────────────────
  // Ranch-owned animals (owner_id null) route to the "Legacy (Me)" owner
  // (grazing_owners.is_self) so the cost still lands in expense history and
  // Schedule F. That owner is excluded from customer invoicing, and the P/L
  // breeding-costs line skips ranch-owned animals so this is not counted twice.
  let expenseOwnerId: string | null = animal.owner_id ?? null
  if (conception_method === 'ai' && !expenseOwnerId) {
    const { data: selfOwner } = await supabase
      .from('grazing_owners')
      .select('id')
      .eq('is_self', true)
      .maybeSingle()
    expenseOwnerId = selfOwner?.id ?? null
  }

  if (conception_method === 'ai' && expenseOwnerId) {
    const { quarter, year } = quarterOf(event_date)
    const sirePart = sire_name_text ? ` — ${sire_name_text}` : ''

    const rows: Record<string, unknown>[] = []

    if (resolvedAiCost != null && resolvedAiCost > 0) {
      rows.push({
        category_name:         'AI Technician Fee',
        expense_type:          'owner_specific',
        description:           `AI tech fee${sirePart}`,
        total_amount:          resolvedAiCost,
        expense_date:          event_date,
        owner_id:              expenseOwnerId,
        is_lease_specific:     false,
        quarter,
        year,
        reproduction_event_id: eventId,
      })
    }

    if (resolvedStrawCost != null && resolvedStrawCost > 0) {
      rows.push({
        category_name:         'Semen Straws',
        expense_type:          'owner_specific',
        description:           `Semen straw${sirePart}`,
        total_amount:          resolvedStrawCost,
        expense_date:          event_date,
        owner_id:              expenseOwnerId,
        is_lease_specific:     false,
        quarter,
        year,
        reproduction_event_id: eventId,
      })
    }

    if (rows.length > 0) {
      const { data: expenses } = await supabase
        .from('lease_expenses')
        .insert(rows)
        .select('id')
      if (expenses) {
        for (const e of expenses) expenseIds.push(e.id)
      }
    }
  }

  // ── g. Preg-check reminder for ALL breedings ───────────────────────────────
  const pregDueDate = addDays(event_date, pregCheckDaysOut)
  const { data: reminder } = await supabase
    .from('reminders')
    .insert({
      animal_id,
      reminder_type:         'preg_check',
      title:                 'Preg check due',
      due_date:              pregDueDate,
      reproduction_event_id: eventId,
    })
    .select('id')
    .single()

  if (reminder) reminderId = reminder.id

  // ── h. Return ──────────────────────────────────────────────────────────────
  return NextResponse.json(
    { event, newStrawCount, strawShort, expenseIds, reminderId },
    { status: 201 },
  )
}
