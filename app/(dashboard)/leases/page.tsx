import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'

export default function LeasesPage() {
  return (
    <PageContainer>
      <PageHeader title="Leases" />
      <EmptyState variant="neutral" title="Leases" body="Coming soon" />
    </PageContainer>
  )
}
