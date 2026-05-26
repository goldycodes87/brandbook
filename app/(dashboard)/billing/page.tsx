import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'

export default function BillingPage() {
  return (
    <PageContainer>
      <PageHeader title="Billing" />
      <EmptyState variant="neutral" title="Billing" body="Coming soon" />
    </PageContainer>
  )
}
