export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-auth'
import { roomsFor } from '@/lib/admin-nav'
import { AdminNav } from '@/components/admin/AdminNav'

/**
 * The admin section.
 *
 * Gated here, on the server, once. The proxy already requires an operator
 * cookie to reach any page — this decides whether that operator's ROLE opens
 * the section at all, which the edge cannot know without a database read.
 *
 * An owner or a vet who guesses the URL lands on /dashboard, not on a page
 * that renders and then hides itself.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession()
  if (!session) redirect('/login')
  if (!session.canConfigure && !session.canSeeBilling) redirect('/dashboard')

  const rooms = roomsFor(session)

  return (
    <div className="min-h-dvh" style={{ background: 'var(--surface-0)' }}>
      <AdminNav rooms={rooms} name={session.name} role={session.role} />
      <main className="md:ml-[228px] pb-24 md:pb-0">{children}</main>
    </div>
  )
}
