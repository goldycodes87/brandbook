'use client'

import { use, useEffect, useState } from 'react'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { Button } from '@/components/ui/Button'
import { BrandBookMark } from '@/components/brand/BrandBookMark'

/**
 * Spending a sign-in link.
 *
 * A shell: the token goes to the server, the server decides, and on success it
 * is a hard navigation rather than a router push — the cookie was set on that
 * response and the whole app needs to be running with it.
 */
export default function SignInWithLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [error, setError] = useState('')

  useEffect(() => {
    let off = false
    fetch('/api/auth/redeem-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(j => {
        if (off) return
        if (!j.ok) { setError(j.error ?? 'That link is no longer valid.'); return }
        window.location.href = '/settings?set-password=1'
      })
      .catch(() => { if (!off) setError('Connection error — try the link again.') })
    return () => { off = true }
  }, [token])

  return (
    <div className="min-h-dvh flex items-center justify-center px-6" style={{ background: 'var(--surface-0)' }}>
      <div className="flex flex-col items-center gap-5 text-center" style={{ maxWidth: '22rem' }}>
        <BrandBookMark size={52} color="var(--accent)" />
        {error ? (
          <>
            <ContextBanner tone="danger">{error}</ContextBanner>
            <Button intent="secondary" onClick={() => { window.location.href = '/login' }}>
              BACK TO SIGN IN
            </Button>
          </>
        ) : (
          <p className="type-helper" style={{ color: 'var(--text-muted)' }}>Signing you in…</p>
        )}
      </div>
    </div>
  )
}
