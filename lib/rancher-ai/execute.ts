import { createAdminClient } from '@/lib/supabase/admin'
import { findWriteAction, type ActionContext } from '@/lib/rancher-ai/write-actions'

/**
 * Where a proposal becomes a record.
 *
 * Shared by the tap-to-confirm route and the voice confirm tool so there is
 * exactly one implementation of "actually write it". Two would drift, and the
 * one that drifted would be the one that skipped a check.
 *
 * The writing itself lives in lib/rancher-ai/write-actions.ts, one entry per
 * action. This file's remaining job is the part every action shares: find the
 * action, run it, and log that it happened. When that list held its own copy
 * of each action's validation, the copy was where a check went missing.
 *
 * Nothing here trusts its input. A payload arrives either from a browser or
 * from a model that heard it over a phone, and both are worth exactly the same
 * amount of trust: none — so each action re-validates its own payload rather
 * than believing what the proposal said.
 */

export type ExecuteResult =
  | { ok: true; confirmation: string; table: string; rowId: string | null }
  | { ok: false; error: string }

export async function executeProposal(opts: {
  action: string
  payload: Record<string, unknown>
  channel: 'text' | 'voice'
  conversationId: string | null
  authUserId: string
  /** Falls back onto administered_by when the rancher did not name somebody. */
  actorName: string
  /** Today in the ranch's timezone. */
  today?: string
  /** The confirming request's cookies, for actions that call back into the API. */
  cookieHeader?: string | null
}): Promise<ExecuteResult> {
  const action = findWriteAction(opts.action)
  if (!action) return { ok: false, error: 'I do not know how to do that' }

  const ctx: ActionContext = {
    authUserId:   opts.authUserId,
    today:        opts.today ?? new Date().toISOString().slice(0, 10),
    actorName:    opts.actorName,
    cookieHeader: opts.cookieHeader ?? null,
  }

  let outcome
  try {
    outcome = await action.execute(opts.payload, ctx)
  } catch (e) {
    outcome = { error: e instanceof Error ? e.message : 'That did not go through.' }
  }

  const result: ExecuteResult = 'error' in outcome
    ? { ok: false, error: outcome.error }
    : { ok: true, confirmation: outcome.confirmation, table: outcome.table, rowId: outcome.rowId }

  // Logged whether it came from a tap or a spoken yes, because those are not
  // equally strong confirmations and a wrong record has to be findable.
  //
  // Failures are logged too. An action that was confirmed and then refused is
  // exactly the thing worth being able to look up later, and the old code only
  // recorded the ones that worked.
  await createAdminClient().from('ai_writes').insert({
    conversation_id: opts.conversationId,
    auth_user_id: opts.authUserId,
    action: opts.action,
    summary: result.ok ? result.confirmation : `FAILED — ${result.error}`,
    channel: opts.channel,
    table_name: result.ok ? result.table : null,
    row_id: result.ok ? result.rowId : null,
  })

  return result
}
