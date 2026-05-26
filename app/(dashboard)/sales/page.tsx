import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'

export default function SalesPage() {
  return (
    <PageContainer>
      <PageHeader title="Sales" />
      <EmptyState variant="neutral" title="Sales" body="Coming soon" />
    </PageContainer>
  )
}
