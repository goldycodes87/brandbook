// The shape of first run, as data.
//
// Owner and vet are the same machine with a different list of steps. Written
// as a config rather than two components because the admin setup interview is
// the next thing to build and will be a third list, not a third flow.

export type PortalRole = 'admin' | 'co_admin' | 'owner' | 'cpa' | 'vet'

export type StepId =
  | 'welcome' | 'details' | 'address' | 'name' | 'brand' | 'tags'
  | 'goals' | 'licence' | 'signature' | 'scope' | 'notify' | 'review' | 'done'

export interface Step {
  id: StepId
  /** Shown in the step's heading. */
  title: string
  /** Counts toward the progress bar. Welcome and done do not. */
  counts: boolean
}

const S = (id: StepId, title: string, counts = true): Step => ({ id, title, counts })

export const OWNER_STEPS: Step[] = [
  S('welcome', 'Welcome', false),
  S('details', 'Your details'),
  S('address', 'Your address'),
  S('name',    'What should we call you?'),
  S('brand',   'Your brand'),
  S('tags',    'Your tag colour'),
  S('goals',   'What is your herd goal?'),
  S('notify',  'What should we notify you about?'),
  S('review',  'Look this over'),
  S('done',    'All set', false),
]

export const VET_STEPS: Step[] = [
  S('welcome',   'Welcome', false),
  S('details',   'You & your practice'),
  S('licence',   'Your licence'),
  S('signature', 'Your signature'),
  S('scope',     "What you'll have access to"),
  S('notify',    'What should we notify you about?'),
  S('review',    'Look this over'),
  S('done',      'All set', false),
]

export function stepsForRole(role: PortalRole): Step[] {
  return role === 'vet' ? VET_STEPS : OWNER_STEPS
}

// ── Options ──────────────────────────────────────────────────────────────

/** Every one is a real reason to run cattle on someone else's grass. */
export const HERD_GOALS = [
  { id: 'grow_herd',     emoji: '📈', label: 'Grow the herd',       hint: 'Keep heifers back' },
  { id: 'return',        emoji: '💰', label: 'Return on the money', hint: 'Sell calves, watch margin' },
  { id: 'family_beef',   emoji: '🥩', label: 'Beef for my family',  hint: 'A steer or two a year' },
  { id: 'tax_savings',   emoji: '🧾', label: 'Tax savings',         hint: 'Schedule F, depreciation' },
  { id: 'ag_valuation',  emoji: '🌾', label: 'Keep my ag valuation', hint: 'Livestock on my ground' },
  { id: 'genetics',      emoji: '🧬', label: 'Build genetics',      hint: 'AI, registered stock' },
  { id: 'pass_on',       emoji: '👪', label: 'Pass it on',          hint: 'Something for my kids' },
] as const

export const OWNER_NOTIFICATIONS = [
  { id: 'calving',  emoji: '🐣', label: 'One of mine calves', default: true },
  { id: 'message',  emoji: '💬', label: 'New message',        default: true },
  { id: 'invoice',  emoji: '🧾', label: 'New invoice',        default: true },
  { id: 'report',   emoji: '📄', label: 'New report',         default: false },
  { id: 'vet',      emoji: '🩺', label: 'Vet treats one of mine', default: false },
] as const

export const VET_NOTIFICATIONS = [
  { id: 'sick',       emoji: '🚨', label: 'Animal flagged sick',  default: true },
  { id: 'case',       emoji: '📋', label: 'New case assigned',    default: true },
  { id: 'chute_day',  emoji: '🗓', label: 'Chute day scheduled',  default: true, hint: 'Preg checks, working' },
  { id: 'withdrawal', emoji: '⏳', label: 'Withdrawal clearing',  default: false },
  { id: 'message',    emoji: '💬', label: 'Message from a ranch', default: false },
] as const

export const EAR_TAG_COLORS = [
  { name: 'White',  hex: '#F2F2EE' },
  { name: 'Yellow', hex: '#D8A657' },
  { name: 'Green',  hex: '#6E9C6B' },
  { name: 'Blue',   hex: '#5B8BB0' },
  { name: 'Red',    hex: '#C0705E' },
  { name: 'Orange', hex: '#E0975A' },
  { name: 'Purple', hex: '#9C7FB0' },
  { name: 'Black',  hex: '#2B322E' },
] as const

/**
 * What a vet can and cannot reach. Rendered as a disclosure, not a choice —
 * someone walking into another operation's records should be told where the
 * wall is before entering data, not after.
 */
export const VET_SCOPE = [
  { allowed: true,  label: 'Health & treatments',  hint: 'Log, edit, sign' },
  { allowed: true,  label: 'Breeding & preg checks' },
  { allowed: true,  label: 'Any animal on the place', hint: 'All owners' },
  { allowed: true,  label: "Other vets' entries",   hint: 'Full history, not just yours' },
  { allowed: false, label: 'Money',                 hint: 'Invoices, costs, owner billing' },
  { allowed: false, label: 'Owner messages' },
] as const

export function defaultNotify(role: PortalRole): Record<string, boolean> {
  const list = role === 'vet' ? VET_NOTIFICATIONS : OWNER_NOTIFICATIONS
  return Object.fromEntries(list.map(n => [n.id, n.default]))
}
