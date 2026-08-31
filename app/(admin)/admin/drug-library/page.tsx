export const dynamic = 'force-dynamic'

import { AdminRoom, NotMovedYet } from '@/components/admin/AdminRoom'

export default function DrugLibraryPage() {
  return (
    <AdminRoom
      href="/admin/drug-library"
      title="DRUG LIBRARY"
      subtitle="The formulary a vet picks from at the chute, and the withdrawal each carries."
    >
      <NotMovedYet
        from="nowhere — it has never had a home"
        items={["37 active products with label withdrawals", "Add your own, with meat and milk days", "Retired products, kept for provenance"]}
      />
    </AdminRoom>
  )
}
