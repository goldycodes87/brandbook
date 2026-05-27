import { Suspense } from 'react'
import { Tag, MapPin, AlertTriangle, FileText } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Panel } from '@/components/ui/Panel'
import { EmptyState } from '@/components/ui/EmptyState'
import { Toolbar } from '@/components/ui/Toolbar'
import { ButtonLink } from '@/components/ui/Button'
import { WithdrawalWidget } from '@/components/health/WithdrawalWidget'

async function DashboardStats() {
  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const [{ count: animalCount }, { count: withdrawalCount }] = await Promise.all([
    supabase.from('animals').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('health_events').select('id', { count: 'exact', head: true })
      .not('withdrawal_clear_date', 'is', null)
      .gte('withdrawal_clear_date', today),
  ])

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <StatCard label="Total Animals" value={animalCount ?? 0} aside={<Tag size={16} style={{ color: 'var(--accent)' }} />} />
      <StatCard label="Active Leases" value={0} aside={<MapPin size={16} style={{ color: 'var(--accent)' }} />} />
      <StatCard label="Health Flags"  value={withdrawalCount ?? 0} aside={<AlertTriangle size={16} style={{ color: withdrawalCount ? 'var(--danger-fg)' : 'var(--accent)' }} />} />
      <StatCard label="Open Invoices" value={0} aside={<FileText size={16} style={{ color: 'var(--accent)' }} />} />
    </div>
  )
}

export default async function DashboardPage() {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <PageContainer variant="narrow">
      <PageHeader
        title="Dashboard"
        subtitle={`${greeting} — Welcome to Brand Book`}
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
            <ButtonLink href="/health?add=true" intent="secondary" size="sm">LOG HEALTH EVENT</ButtonLink>
            <ButtonLink href="/animals?action=weight" intent="secondary" size="sm">RECORD WEIGHT</ButtonLink>
          </>
        }
      />

      {/* Withdrawal tracker */}
      <div className="mb-5">
        <Suspense fallback={null}>
          <WithdrawalWidget />
        </Suspense>
      </div>

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
