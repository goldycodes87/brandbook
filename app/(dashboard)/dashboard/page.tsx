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
  const getGreeting = () => {
    // Mountain Time offset
    // MST = UTC-7, MDT = UTC-6
    const now = new Date();
    const mtHour = new Date(
      now.toLocaleString('en-US', {
        timeZone: 'America/Denver'
      })
    ).getHours();

    if (mtHour >= 5 && mtHour < 12)
      return 'Good morning';
    if (mtHour >= 12 && mtHour < 17)
      return 'Good afternoon';
    if (mtHour >= 17 && mtHour < 21)
      return 'Good evening';
    return 'Good evening';
  };

  const greeting = getGreeting();

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
            <ButtonLink href="/health" intent="secondary" size="sm">LOG HEALTH EVENT</ButtonLink>
            <ButtonLink href="/animals" intent="secondary" size="sm">RECORD WEIGHT</ButtonLink>
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
