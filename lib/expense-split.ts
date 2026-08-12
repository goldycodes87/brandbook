import { apiPost } from '@/lib/fetch'

// Matches the animal_sex enum in the database.
export const ANIMAL_CLASSES = ['cow', 'heifer', 'steer', 'bull', 'calf'] as const
export type AnimalClass = typeof ANIMAL_CLASSES[number]

export interface SplitAnimal {
  id: string
  owner_id?: string | null
}

export interface AnimalSplitInput {
  animalIds: string[]
  animals: SplitAnimal[]
  /** The grazing_owners row with is_self = true, used for ranch-owned animals. */
  selfOwnerId: string | null
  totalAmount: number
  categoryName: string
  categoryId: string | null
  description?: string | null
  expenseDate?: string | null
  notes?: string | null
}

export interface AnimalSplitRow {
  category_name: string
  category_id: string | null
  expense_type: 'animal_specific'
  description: string | null
  total_amount: number
  expense_date: string | null
  notes: string | null
  owner_id: string | null
  animal_id: string
  is_lease_specific: false
}

/**
 * Split a total equally across the selected animals — one lease_expenses row
 * per animal, regardless of owner or lease.
 *
 * Math is done in whole cents so the shares always sum to the total exactly.
 * The leftover pennies are handed out one each to the first `remainder`
 * animals, so no two shares differ by more than a cent. (Dumping the whole
 * remainder on the last row instead makes that one animal absorb up to N-1
 * cents — 41c of a $1.00 split across 60 head — which skews its cost basis.)
 *
 * Each row is routed to that animal's own owner, falling back to the ranch's
 * "self" owner (Legacy (Me)) for ranch-owned animals so the cost still lands
 * in P&L / Schedule F.
 */
export function buildAnimalSplitRows(input: AnimalSplitInput): AnimalSplitRow[] {
  const { animalIds, animals, selfOwnerId, totalAmount } = input
  const N = animalIds.length
  if (N === 0) return []

  const totalCents   = Math.round(totalAmount * 100)
  const perHeadCents = Math.floor(totalCents / N)
  const remainder    = totalCents - perHeadCents * N   // 0 .. N-1

  return animalIds.map((aId, idx): AnimalSplitRow => {
    const animal     = animals.find(a => a.id === aId)
    const shareCents = perHeadCents + (idx < remainder ? 1 : 0)

    return {
      category_name:     input.categoryName,
      category_id:       input.categoryId,
      expense_type:      'animal_specific',
      description:       input.description?.trim() || null,
      total_amount:      shareCents / 100,
      expense_date:      input.expenseDate || null,
      notes:             input.notes || null,
      owner_id:          animal?.owner_id ?? selfOwnerId ?? null,
      animal_id:         aId,
      is_lease_specific: false,
    }
  })
}

/**
 * Build and save an equal-per-head animal split.
 *
 * The whole split goes up as one request and is inserted in a single
 * statement, so it either lands completely or not at all. (It used to be one
 * sequential POST per animal, which could leave a half-saved split behind if
 * the network dropped mid-way.)
 */
export async function postAnimalSplitExpense(
  input: AnimalSplitInput
): Promise<{ ok: boolean; error?: string; saved: number }> {
  const rows = buildAnimalSplitRows(input)
  if (rows.length === 0) return { ok: true, saved: 0 }

  const res  = await apiPost('/api/expenses', { rows })
  const json = await res.json().catch(() => ({}))

  if (!res.ok) return { ok: false, error: json.error ?? 'Save failed', saved: 0 }
  return { ok: true, saved: Array.isArray(json.data) ? json.data.length : rows.length }
}
