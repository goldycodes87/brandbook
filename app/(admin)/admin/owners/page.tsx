export const dynamic = 'force-dynamic'

import { AdminRoom } from '@/components/admin/AdminRoom'
import { OwnersRoom } from '@/components/admin/OwnersRoom'

export default function OwnersPage() {
  return (
    <AdminRoom
      href="/admin/owners"
      title="OWNERS"
      subtitle="The people whose cattle you run, and the terms you run them on."
    >
      <OwnersRoom />
    </AdminRoom>
  )
}
