export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { executeProposal } from '@/lib/rancher-ai/execute'

/**
 * The tap. A proposal the rancher confirmed on screen.
 *
 * The work is in lib/rancher-ai/execute, shared with the voice path, so there
 * is one implementation of "actually write it" rather than two that drift.
 */
export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session?.canConfigure) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const action = typeof body.action === 'string' ? body.action : ''
  const payload = (body.payload ?? {}) as Record<string, unknown>
  const conversationId = typeof body.conversation_id === 'string' ? body.conversation_id : null

  const result = await executeProposal({
    action,
    payload,
    channel: 'text',
    conversationId,
    authUserId: session.authUserId,
    actorName: session.name,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true, confirmation: result.confirmation })
}
