import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'

export default function InventoryPage() {
  return (
    <PageContainer>
      <PageHeader title="Inventory" />
      <EmptyState variant="neutral" title="Inventory" body="Coming soon" />
    </PageContainer>
  )
}
