export const dynamic = 'force-dynamic'

import { AdminRoom } from '@/components/admin/AdminRoom'
import { DrugLibraryRoom } from '@/components/admin/DrugLibraryRoom'

export default function DrugLibraryPage() {
  return (
    <AdminRoom
      href="/admin/drug-library"
      title="DRUG LIBRARY"
      subtitle="The formulary a vet picks from at the chute, and the withdrawal each carries."
    >
      <DrugLibraryRoom />
    </AdminRoom>
  )
}
