export const dynamic = 'force-dynamic'

import { AdminRoom } from '@/components/admin/AdminRoom'
import { DataRoom } from '@/components/admin/DataRoom'

export default function DataPage() {
  return (
    <AdminRoom
      href="/admin/data"
      title="DATA"
      subtitle="Import, export and cleanup. The room that can undo the herd record."
    >
      <DataRoom />
    </AdminRoom>
  )
}
