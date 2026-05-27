export const dynamic = 'force-dynamic'
export const revalidate = 0

import { Suspense } from 'react'
import { Tag, MapPin, FileText } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Panel } from '@/components/ui/Panel'
import { EmptyState } from '@/components/ui/EmptyState'
import { Toolbar } from '@/components/ui/Toolbar'
import { ButtonLink } from '@/components/ui/Button'
import { WeightLogSheet } from '@/components/weights/WeightLogSheet'

async function DashboardStats() {
  const supabase = createAdminClient()

  const [{ count: total }, bullsRes, cowsRes] = await Promise.all([
    supabase.from('animals').select('id', { count: 'exact', head: true }),
    supabase.from('animals').select('id', { count: 'exact', head: true }).eq('sex', 'bull'),
    supabase.from('animals').select('id', { count: 'exact', head: true }).in('sex', ['cow', 'heifer']),
  ])

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <StatCard label="Total Animals"  value={total ?? 0}             aside={<Tag size={16} style={{ color: 'var(--accent)' }} />} />
      <StatCard label="Bulls"          value={bullsRes.count ?? 0}    aside={<span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '1rem' }}>♂</span>} />
      <StatCard label="Cows / Heifers" value={cowsRes.count ?? 0}     aside={<span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '1rem' }}>♀</span>} />
      <StatCard label="Open Invoices"  value={0}                      aside={<FileText size={16} style={{ color: 'var(--accent)' }} />} />
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = createAdminClient()
  const { data: ranchSettings } = await supabase
    .from('ranch_settings')
    .select('owner_name, timezone')
    .maybeSingle()

  const timezone = ranchSettings?.timezone ?? 'America/Denver'
  const ownerName = ranchSettings?.owner_name ?? ''

  const now = new Date()
  const hour = new Date(now.toLocaleString('en-US', { timeZone: timezone })).getHours()
  const greeting =
    hour >= 5 && hour < 12 ? 'Good morning' :
    hour >= 12 && hour < 17 ? 'Good afternoon' :
    'Good evening'

  const subtitle = ownerName
    ? `${greeting}, ${ownerName}`
    : `${greeting} — Welcome to Brand Book`

  return (
    <PageContainer variant="narrow">
      <PageHeader
        title="Dashboard"
        subtitle={subtitle}
      />

      <Suspense fallback={
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-[var(--radius-lg)] animate-pulse" style={{ backgroundColor: 'var(--surface-2)' }} />
          ))}
        </div>
      }>
        <DashboardStats />
      </Suspense>

      {/* Quick actions */}
      <Toolbar
        className="mb-6"
        leading={
          <>
            <ButtonLink href="/animals/new" intent="primary" size="sm">+ ADD ANIMAL</ButtonLink>
            <ButtonLink href="/health" intent="secondary" size="sm">LOG HEALTH EVENT</ButtonLink>
            <WeightLogSheet />
          </>
        }
      />

      {/* Recent activity */}
      <Panel title="RECENT ACTIVITY">
        <EmptyState
          variant="action"
          title="No activity yet"
          body="Add your first animal to get started."
          action={<ButtonLink href="/animals/new" intent="primary">+ ADD ANIMAL</ButtonLink>}
          panel={false}
        />
      </Panel>
    </PageContainer>
  )
}
