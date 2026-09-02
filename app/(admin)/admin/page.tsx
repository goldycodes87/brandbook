export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminSession } from '@/lib/admin-auth'
import { roomsFor } from '@/lib/admin-nav'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { ConfigCheck } from '@/components/admin/ConfigCheck'

/**
 * Opens with the state of the operation rather than a form.
 *
 * Everything here is a count the operator would otherwise go and look for in a
 * different room, which is the whole argument for the section existing.
 */
async function overview() {
  const supabase = createAdminClient()

  const [head, owners, pendingReceipts, people, unbilled] = await Promise.all([
    supabase.from('animals').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('grazing_owners').select('id', { count: 'exact', head: true }).eq('is_self', false),
    supabase.from('inbound_receipts').select('id', { count: 'exact', head: true }).is('reviewed_at', null),
    supabase.from('portal_memberships').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    // Expense shares nobody has invoiced yet. An allocation with no invoice_id
    // is money owed that has not been asked for.
    supabase.from('lease_expenses').select('total_amount').is('invoice_id', null),
  ])

  const unbilledTotal = ((unbilled.data ?? []) as Array<{ total_amount: number }>)
    .reduce((s, r) => s + (Number(r.total_amount) || 0), 0)

  return {
    head:            head.count ?? 0,
    owners:          owners.count ?? 0,
    pendingReceipts: pendingReceipts.count ?? 0,
    people:          people.count ?? 0,
    unbilledTotal,
  }
}

/** What the setup interview will eventually fill in, checked live until then. */
async function setupProgress() {
  const supabase = createAdminClient()
  const [{ data: ranch }, { data: owner }, { data: vet }, { data: drugs }] = await Promise.all([
    supabase.from('ranch_settings')
      .select('ranch_name, address, brand_photo_url, default_breed, default_ear_tag_color, treatment_labor_per_head')
      .limit(1).maybeSingle(),
    supabase.from('grazing_owners').select('id').eq('is_self', false).limit(1),
    supabase.from('portal_memberships').select('id').eq('role', 'vet').limit(1),
    supabase.from('drug_library').select('id').eq('is_active', true).limit(1),
  ])

  const r = (ranch ?? {}) as Record<string, unknown>
  const checks: Array<[string, boolean, string]> = [
    ['Ranch name and address', Boolean(r.ranch_name && r.address), '/admin/ranch'],
    ['A brand on file',        Boolean(r.brand_photo_url),          '/admin/ranch'],
    ['Herd defaults',          Boolean(r.default_breed && r.default_ear_tag_color), '/admin/defaults'],
    ['An owner set up',        ((owner ?? []) as unknown[]).length > 0, '/admin/owners'],
    ['A vet invited',          ((vet ?? []) as unknown[]).length > 0,   '/admin/people'],
    ['Treatment labour rate',  r.treatment_labor_per_head != null,      '/admin/billing'],
    ['Drug formulary',         ((drugs ?? []) as unknown[]).length > 0, '/admin/drug-library'],
  ]

  return { checks, done: checks.filter(c => c[1]).length }
}

export default async function AdminOverviewPage() {
  const session = await getAdminSession()
  if (!session) return null

  const [o, setup] = await Promise.all([overview(), setupProgress()])
  const rooms = roomsFor(session).filter(r => r.href !== '/admin')

  const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

  return (
    <PageContainer>
      <PageHeader
        eyebrow="ADMIN"
        title="OVERVIEW"
        subtitle={`Signed in as ${session.name}`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label="HEAD ON THE PLACE" value={o.head} />
        <StatCard label="OWNERS" value={o.owners} meta="not counting your own" />
        {session.canSeeBilling && (
          <StatCard label="UNBILLED EXPENSES" value={money(o.unbilledTotal)}
            valueColor="var(--gold-fg, #d97706)" meta="not yet on an invoice" />
        )}
        <StatCard label="RECEIPTS TO REVIEW" value={o.pendingReceipts}
          valueColor={o.pendingReceipts > 0 ? 'var(--gold-fg, #d97706)' : undefined} />
      </div>

      {/* Setup progress — replaced by the interview later, useful now. */}
      {session.canConfigure && (
        <div className="rounded-lg mb-6" style={{ border: '1px solid var(--border)', background: 'var(--surface-1)' }}>
          <div className="px-4 py-3 flex justify-between items-baseline"
               style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
            <span className="type-section-label" style={{ color: 'var(--text-muted)' }}>SETUP</span>
            <span className="text-sm font-semibold">{setup.done} of {setup.checks.length}</span>
          </div>
          {setup.checks.map(([label, done, href]) => (
            <Link key={label} href={href}
              className="flex items-center gap-3 px-4 py-2.5 text-sm"
              style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text)' }}>
              <span style={{ color: done ? 'var(--success-fg)' : 'var(--text-muted)' }}>{done ? '✓' : '○'}</span>
              <span className="flex-1" style={{ color: done ? 'var(--text-muted)' : 'var(--text)' }}>{label}</span>
              {!done && <span className="type-helper" style={{ color: 'var(--accent)' }}>Set up →</span>}
            </Link>
          ))}
        </div>
      )}

      {/* What this deployment actually has. Above the room list because a
          missing key is the reason a room will not work when you open it. */}
      {session.canConfigure && (
        <div className="mb-6">
          <ConfigCheck />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 pb-8">
        {rooms.map(r => (
          <Link key={r.href} href={r.href}
            className="rounded-lg px-4 py-3 flex items-start gap-3"
            style={{ border: '1px solid var(--border)', background: 'var(--surface-1)' }}>
            <span style={{ fontSize: 18 }}>{r.icon}</span>
            <span>
              <span className="block text-sm font-semibold" style={{ color: 'var(--text)' }}>{r.label}</span>
              <span className="block type-helper" style={{ color: 'var(--text-muted)' }}>{r.blurb}</span>
            </span>
          </Link>
        ))}
      </div>
    </PageContainer>
  )
}
