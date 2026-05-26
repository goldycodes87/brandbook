import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'

export default function GeneticsPage() {
  return (
    <PageContainer>
      <PageHeader title="Genetics" />
      <EmptyState variant="neutral" title="Genetics" body="Coming soon" />
    </PageContainer>
  )
}
