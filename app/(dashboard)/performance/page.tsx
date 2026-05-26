import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'

export default function PerformancePage() {
  return (
    <PageContainer>
      <PageHeader title="Performance" />
      <EmptyState variant="neutral" title="Performance" body="Coming soon" />
    </PageContainer>
  )
}
