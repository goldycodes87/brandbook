export const dynamic = 'force-dynamic'

import { AdminRoom, NotMovedYet } from '@/components/admin/AdminRoom'

export default function DataPage() {
  return (
    <AdminRoom
      href="/admin/data"
      title="DATA"
      subtitle="Import, export and cleanup. The room that can undo the herd record."
    >
      <NotMovedYet
        from="Settings → Data"
        items={["Bulk animal import from a spreadsheet", "Export animals, weights, health, sales", "Data cleanup and de-duplication"]}
      />
    </AdminRoom>
  )
}
