export const dynamic = 'force-dynamic'

import { AdminRoom, NotMovedYet } from '@/components/admin/AdminRoom'

export default function PeopleRolesPage() {
  return (
    <AdminRoom
      href="/admin/people"
      title="PEOPLE & ROLES"
      subtitle="Everyone with a login, and exactly what each one can reach."
    >
      <NotMovedYet
        from="Settings → Users & Access"
        items={["Invite a person and set their role", "Ranch Manager, CPA, Vet and Owner access", "Revoke a login without deleting the record", "Pending invites and who has not accepted"]}
      />
    </AdminRoom>
  )
}
