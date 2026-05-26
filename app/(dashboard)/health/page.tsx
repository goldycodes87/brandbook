import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'

export default function HealthPage() {
  return (
    <PageContainer>
      <PageHeader title="Health" />
      <EmptyState variant="neutral" title="Health" body="Coming soon" />
    </PageContainer>
  )
}
