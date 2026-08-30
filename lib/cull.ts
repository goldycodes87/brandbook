// The cull list — cows decided against but still in the herd.
//
// A cull decision and a disposition are separate events, usually months apart:
// she is flagged at the chute and leaves when she is actually sold. Flagging
// her does NOT change animals.status, so she keeps counting for head counts,
// grazing billing and the herd report right up until Disposition records the
// sale. Being on the list only makes her unbreedable.

export const CULL_REASONS = [
  'Open',
  'Age',
  'Temperament',
  'Feet / udder',
  'Performance',
  'Health',
  'Other',
] as const

export type CullReason = typeof CULL_REASONS[number]

/** Free text is accepted too, so this trims rather than rejects. */
export function normalizeCullReason(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, 200) : null
}
