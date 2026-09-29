'use client'

import { useEffect, useState, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { BrandBookMark } from '@/components/brand/BrandBookMark'
import { ContextBanner } from '@/components/ui/ContextBanner'

/**
 * The invite link.
 *
 * One job: swap the token for a session, then send them where they belong —
 * into first run if they have never done it, straight to their portal if they
 * have. Everything role-specific happens after this; the only thing that
 * differs here is the destination.
 */
export default function WelcomePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()
  const [error, setError] = useState('')

  /**
   * Redeemed once, whatever React does with the effect.
   *
   * `off` only stopped the RESPONSE being acted on; the request still went.
   * In development and under StrictMode this fired three times, and the third
   * came back 401 — the earlier calls had already rotated what it was
   * redeeming. Harmless in the end, but it writes a failed sign-in into the
   * logs for a sign-in that worked, and that is exactly the sort of noise
   * somebody later spends an hour chasing.
   */
  const redeemed = useRef(false)

  useEffect(() => {
    if (redeemed.current) return
    redeemed.current = true

    let off = false
    fetch('/api/portal/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(j => {
        if (off) return
        if (!j.ok) { setError(j.error ?? 'That link is no longer valid.'); return }
        if (!j.onboarded) { router.replace('/onboarding'); return }
        router.replace(j.role === 'vet' ? '/vet/dashboard' : '/owner')
      })
      .catch(() => { if (!off) setError('Connection error — try that link again.') })
    return () => { off = true }
  }, [token, router])

  return (
    <div className="min-h-dvh flex items-center justify-center px-6" style={{ background: 'var(--surface-0)' }}>
      <div className="flex flex-col items-center gap-5 text-center">
        <BrandBookMark size={52} color="var(--accent)" />
        {error
          ? <ContextBanner tone="danger">{error}</ContextBanner>
          : <p className="type-helper" style={{ color: 'var(--text-muted)' }}>Signing you in…</p>}
      </div>
    </div>
  )
}
