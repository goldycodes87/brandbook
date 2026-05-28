export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { StatusChip } from '@/components/ui/Chip'
import { REPRO_CHIP, SEX_CHIP } from '@/components/ui/tokens'
import { ReproListClient } from '@/components/reproduction/ReproListClient'

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

async function SummaryStats() {
  const supabase   = createAdminClient()
  const yearStart  = `${new Date().getFullYear()}-01-01`

  const [bredRes, confirmedRes, openRes, calvedRes] = await Promise.all([
    supabase.from('reproduction_events').select('id', { count: 'exact', head: true }).eq('event_type', 'bred'),
    supabase.from('reproduction_events').select('id', { count: 'exact', head: true }).eq('preg_check_result', 'confirmed'),
    supabase.from('reproduction_events').select('id', { count: 'exact', head: true }).eq('preg_check_result', 'open'),
    supabase.from('reproduction_events').select('id', { count: 'exact', head: true }).eq('event_type', 'calved').gte('event_date', yearStart),
  ])

  const confirmed = confirmedRes.count ?? 0
  const open      = openRes.count ?? 0
  const pregRate  = confirmed + open > 0
    ? `${Math.round((confirmed / (confirmed + open)) * 100)}%`
    : '—'

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <StatCard label="Total Bred"         value={bredRes.count ?? 0} />
      <StatCard
        label="Confirmed Pregnant"
        value={confirmed}
        aside={<span className="type-helper" style={{ color: 'var(--success-fg)' }}>{pregRate} rate</span>}
      />
      <StatCard
        label="Open / Recheck"
        value={open}
      />
      <StatCard label="Calves This Year" value={calvedRes.count ?? 0} />
    </div>
  )
}

export default async function ReproductionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>
}) {
  const sp  = await searchParams
  const tab = sp.tab ?? 'all'

  return (
    <PageContainer>
      <PageHeader
        eyebrow="LIVESTOCK"
        title="Reproduction"
        subtitle="Breeding and calving records"
        actions={
          <>
            <ButtonLink href="/reproduction/calving" intent="primary" size="sm">+ CALVING ENTRY</ButtonLink>
          </>
        }
      />

      {/* Quick nav */}
      <div className="flex gap-2 flex-wrap mb-5">
        <ButtonLink href="/reproduction/calving" intent="secondary" size="sm">CALVING ENTRY</ButtonLink>
        <ButtonLink href="/reproduction?tab=bred" intent="ghost" size="sm">BREEDING RECORDS</ButtonLink>
        <ButtonLink href="/reproduction?tab=preg_check" intent="ghost" size="sm">PREG CHECKS</ButtonLink>
      </div>

      <Suspense fallback={
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-[var(--radius-lg)]" style={{ backgroundColor: 'var(--surface-2)' }} />
          ))}
        </div>
      }>
        <SummaryStats />
      </Suspense>

      <ReproListClient defaultTab={tab} />
    </PageContainer>
  )
}
