// The rooms of the admin section.
//
// A list rather than markup because three things read it: the desktop sidebar,
// the mobile bar, and the gate on each page. Two copies would eventually
// disagree about who may open Data, which is the one room where that matters.

import type { AdminSession } from '@/lib/admin-auth'

/** A room as a client component may receive it: data only, no behaviour. */
export interface AdminRoomLink {
  href: string
  label: string
  icon: string
  /** One line, shown on the Overview's room list. */
  blurb: string
}

export interface AdminRoom extends AdminRoomLink {
  /** Who may open it. Server-side only — see navRoomsFor below. */
  allows: (s: AdminSession) => boolean
}

const configurer = (s: AdminSession) => s.canConfigure

export const ADMIN_ROOMS: AdminRoom[] = [
  { href: '/admin',              label: 'Overview',        icon: '📊',
    blurb: 'Where the operation stands, and what setup is unfinished',
    allows: () => true },

  { href: '/admin/ranch',        label: 'Ranch',           icon: '🏠',
    blurb: 'Name, address, brand, logo, timezone',
    allows: configurer },

  { href: '/admin/people',       label: 'People & Roles',  icon: '👥',
    blurb: 'Everyone with a login, what each can reach, invites',
    allows: configurer },

  { href: '/admin/owners',       label: 'Owners',          icon: '🐄',
    blurb: 'Grazing owners, contracts, portal links',
    allows: configurer },

  { href: '/admin/billing',      label: 'Billing & Rates', icon: '💵',
    blurb: 'Grazing rates, AI fee, treatment labour, sale fees, categories',
    // The only room a CPA reaches — read-only, enforced inside the page.
    allows: s => s.canSeeBilling },

  { href: '/admin/defaults',     label: 'Defaults',        icon: '⚙️',
    blurb: 'Breed, tag colour, numbering, breeding method',
    allows: configurer },

  { href: '/admin/drug-library', label: 'Drug Library',    icon: '💊',
    blurb: 'The formulary and its withdrawal times',
    allows: configurer },

  { href: '/admin/data',         label: 'Data',            icon: '📦',
    blurb: 'Import, export, cleanup',
    // Admin only. Import and cleanup can destroy the herd record, and a Ranch
    // Manager runs everything else without ever seeing this.
    allows: s => s.canManageData },
]

export function roomsFor(session: AdminSession): AdminRoom[] {
  return ADMIN_ROOMS.filter(r => r.allows(session))
}

/**
 * The same rooms, stripped of `allows`, for the client-side nav.
 *
 * Handing the full room to a client component is what broke the whole admin
 * section: React cannot serialize a function across the server/client
 * boundary, so every /admin page threw "Functions cannot be passed directly to
 * Client Components" and returned a 500 — but only once somebody was signed in
 * far enough to reach the layout, which is why it looked like a missing page.
 *
 * The predicate has no business in the browser regardless. Access is decided
 * on the server, in the layout and again per room; a copy in the client would
 * be a suggestion.
 */
export function navRoomsFor(session: AdminSession): AdminRoomLink[] {
  return roomsFor(session).map(({ href, label, icon, blurb }) => ({ href, label, icon, blurb }))
}

export function roomFor(pathname: string): AdminRoom | undefined {
  // Longest match first so /admin/drug-library does not resolve to /admin.
  return [...ADMIN_ROOMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find(r => pathname === r.href || pathname.startsWith(r.href + '/'))
}
