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
        <StatCard
          title="Total Animals"
          value={0}
          icon={<Tag size={18} />}
        />
        <StatCard
          title="Active Leases"
          value={0}
          icon={<MapPin size={18} />}
        />
        <StatCard
          title="Health Flags"
          value={0}
          icon={<AlertTriangle size={18} />}
        />
        <StatCard
          title="Open Invoices"
          value={0}
          icon={<FileText size={18} />}
        />
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
        />
      </Panel>
    </PageContainer>
  )
}
