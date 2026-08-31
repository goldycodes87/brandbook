// The rooms of the admin section.
//
// A list rather than markup because three things read it: the desktop sidebar,
// the mobile bar, and the gate on each page. Two copies would eventually
// disagree about who may open Data, which is the one room where that matters.

import type { AdminSession } from '@/lib/admin-auth'

export interface AdminRoom {
  href: string
  label: string
  icon: string
  /** One line, shown on the Overview's room list. */
  blurb: string
  /** Who may open it. */
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

export function roomFor(pathname: string): AdminRoom | undefined {
  // Longest match first so /admin/drug-library does not resolve to /admin.
  return [...ADMIN_ROOMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find(r => pathname === r.href || pathname.startsWith(r.href + '/'))
}
