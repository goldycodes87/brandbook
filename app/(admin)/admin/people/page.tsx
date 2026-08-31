export const dynamic = 'force-dynamic'

import { AdminRoom } from '@/components/admin/AdminRoom'
import { PeopleAndRoles } from '@/components/admin/PeopleAndRoles'

export default function PeoplePage() {
  return (
    <AdminRoom
      href="/admin/people"
      title="PEOPLE & ROLES"
      subtitle="Everyone with a login, and exactly what each one can reach."
    >
      <PeopleAndRoles />
    </AdminRoom>
  )
}
