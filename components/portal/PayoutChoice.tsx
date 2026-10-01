'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * The owner pressed a payout button in a sale email.
 *
 * The email carries ?payout=check|buy|invoice and, where it has one, &sale=.
 * This records the instruction, confirms it on screen, and takes the
 * parameters back out of the address bar so a refresh or a shared link does
 * not file it a second time.
 *
 * It records an instruction and moves no money. The ranch reads it on the
 * Requests screen and acts.
 */

const COPY: Record<string, { confirm: string; detail: string }> = {
  check:   { confirm: 'A check is on the way.',        detail: 'Grant has been told to post it.' },
  buy:     { confirm: 'Held for your next purchase.',  detail: 'Tell Grant what you are looking for and he will keep an eye out.' },
  invoice: { confirm: 'Your invoice will be settled first.', detail: 'The balance follows once it is paid off.' },
}

export function PayoutChoice() {
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [choice, setChoice] = useState<string | null>(null)
  // Strict mode mounts twice in development, and a double POST here would file
  // the instruction twice. The guard is on the request, not the response.
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return

    const params = new URLSearchParams(window.location.search)
    const picked = params.get('payout')
    if (!picked || !COPY[picked]) return

    fired.current = true
    setChoice(picked)
    setState('saving')

    fetch('/api/portals/owner/payout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ choice: picked, sale_id: params.get('sale') || undefined }),
    })
      .then(r => setState(r.ok ? 'done' : 'error'))
      .catch(() => setState('error'))
      .finally(() => {
        const url = new URL(window.location.href)
        url.searchParams.delete('payout')
        url.searchParams.delete('sale')
        window.history.replaceState({}, '', url.toString())
      })
  }, [])

  if (state === 'idle' || !choice) return null

  const c = COPY[choice]
  const failed = state === 'error'

  return (
    <div
      role="status"
      style={{
        borderRadius: 14,
        border: `1px solid ${failed ? 'var(--warning-fg)' : 'var(--accent)'}`,
        background: 'var(--surface-1)',
        padding: '14px 16px',
        marginBottom: 14,
      }}
    >
      <p style={{
        margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
        textTransform: 'uppercase', color: failed ? 'var(--warning-fg)' : 'var(--accent)',
      }}>
        {state === 'saving' ? 'Recording…' : failed ? 'That did not save' : 'Noted'}
      </p>
      <p style={{ margin: '6px 0 0', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
        {failed ? 'Send Grant a message and he will sort it.' : c.confirm}
      </p>
      {!failed && state === 'done' && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55 }}>
          {c.detail}
        </p>
      )}
    </div>
  )
}
