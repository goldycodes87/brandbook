import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-auth'
import { ADMIN_ROOMS } from '@/lib/admin-nav'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'

/**
 * A room, gated on its own terms.
 *
 * The layout only asks "may this person reach the admin section at all", which
 * a CPA can. Whether they may open THIS room is a second question, and it has
 * to be asked per page — otherwise a CPA typing /admin/data gets the dangerous
 * room because the section let them through the front door.
 */
export async function AdminRoom({
  href,
  eyebrow = 'ADMIN',
  title,
  subtitle,
  children,
}: {
  href: string
  eyebrow?: string
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
  const session = await getAdminSession()
  if (!session) redirect('/login')

  const room = ADMIN_ROOMS.find(r => r.href === href)
  if (!room || !room.allows(session)) redirect('/admin')

  return (
    <PageContainer>
      <PageHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
      {children}
    </PageContainer>
  )
}

/**
 * Placeholder for a room whose contents have not moved yet.
 *
 * Names what is coming and where it lives today, so the section is navigable
 * from the first commit and nobody has to guess whether a room is empty or
 * broken.
 */
export function NotMovedYet({ items, from }: { items: string[]; from: string }) {
  return (
    <div
      className="rounded-lg px-5 py-5 flex flex-col gap-3"
      style={{ border: '1px dashed var(--border)', background: 'var(--surface-1)' }}
    >
      <p className="text-sm" style={{ color: 'var(--text)' }}>
        This room is built but empty. Its contents still live in {from} and move here next,
        unchanged — each one keeps working the day it moves.
      </p>
      <ul className="flex flex-col gap-1.5 pl-5 text-sm" style={{ color: 'var(--text-muted)' }}>
        {items.map(i => <li key={i} style={{ listStyle: 'disc' }}>{i}</li>)}
      </ul>
    </div>
  )
}
