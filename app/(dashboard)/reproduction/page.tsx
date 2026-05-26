import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'

export default function ReproductionPage() {
  return (
    <PageContainer>
      <PageHeader title="Reproduction" />
      <EmptyState variant="neutral" title="Reproduction" body="Coming soon" />
    </PageContainer>
  )
}
