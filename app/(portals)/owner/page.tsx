export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPortalSession } from '@/lib/portal-auth'

/**
 * Where an owner lands after signing in.
 *
 * This route did not exist. Both the invite flow and the last step of
 * onboarding redirect here — so an owner following their link went through the
 * whole welcome, finished setting up, and hit a 404 as their first sight of
 * the portal. Only /owner/[token] was ever built.
 *
 * It resolves the signed-in membership to that owner's portal token and hands
 * off to the page that already works, rather than growing a second copy of the
 * portal that would drift from the first.
 */
export default async function OwnerHome() {
  const session = await getPortalSession()

  // No session: the link is how you get one. Send them somewhere that says so
  // rather than to an operator login they have no account for.
  if (!session) redirect('/login')

  if (session.role !== 'owner') {
    redirect(session.role === 'vet' ? '/vet/dashboard' : '/dashboard')
  }

  // Onboarding is part of the way in, not an optional extra.
  if (!session.onboarded) redirect('/onboarding')

  if (!session.ownerId) redirect('/onboarding')

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('grazing_owners')
    .select('portal_token')
    .eq('id', session.ownerId)
    .maybeSingle()

  const token = (data as { portal_token: string | null } | null)?.portal_token
  if (!token) {
    // An owner with no portal token cannot be shown their cattle. Say so
    // plainly rather than rendering an empty portal that looks like they have
    // none.
    return (
      <div className="min-h-dvh flex items-center justify-center px-6" style={{ background: 'var(--surface-0)' }}>
        <p className="type-body text-center" style={{ color: 'var(--text-muted)', maxWidth: '22rem' }}>
          Your account is set up, but your herd view has not been switched on yet.
          Let the ranch know and they can finish it in a moment.
        </p>
      </div>
    )
  }

  redirect(`/owner/${token}`)
}
