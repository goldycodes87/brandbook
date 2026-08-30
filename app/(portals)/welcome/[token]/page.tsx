'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { BrandBookMark } from '@/components/portal/BrandBookMark'
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

  useEffect(() => {
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
