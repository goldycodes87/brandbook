import { Tag, MapPin, AlertTriangle, FileText } from 'lucide-react'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Panel } from '@/components/ui/Panel'
import { EmptyState } from '@/components/ui/EmptyState'
import { Toolbar } from '@/components/ui/Toolbar'
import { Button } from '@/components/ui/Button'

export default function DashboardPage() {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <PageContainer variant="narrow">
      <PageHeader
        title="Dashboard"
        subtitle={`${greeting} — Welcome to Brand Book`}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Animals" value={0} aside={<Tag size={16} style={{ color: 'var(--accent)' }} />} />
        <StatCard label="Active Leases" value={0} aside={<MapPin size={16} style={{ color: 'var(--accent)' }} />} />
        <StatCard label="Health Flags"  value={0} aside={<AlertTriangle size={16} style={{ color: 'var(--accent)' }} />} />
        <StatCard label="Open Invoices" value={0} aside={<FileText size={16} style={{ color: 'var(--accent)' }} />} />
      </div>

      {/* Quick actions */}
      <Toolbar
        className="mb-6"
        leading={
          <>
            <Button intent="primary" size="sm">+ ADD ANIMAL</Button>
            <Button intent="secondary" size="sm">LOG HEALTH EVENT</Button>
            <Button intent="secondary" size="sm">RECORD WEIGHT</Button>
          </>
        }
      />

      {/* Recent activity */}
      <Panel title="RECENT ACTIVITY">
        <EmptyState
          variant="action"
          title="No activity yet"
          body="Add your first animal to get started."
          action={<Button intent="primary">+ ADD ANIMAL</Button>}
          panel={false}
        />
      </Panel>
    </PageContainer>
  )
}
