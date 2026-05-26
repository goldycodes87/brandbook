import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'

export default function AnimalsPage() {
  return (
    <PageContainer>
      <PageHeader title="Animals" />
      <EmptyState variant="neutral" title="Animals" body="Coming soon" />
    </PageContainer>
  )
}
