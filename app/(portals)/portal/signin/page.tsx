'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { BrandBookMark } from '@/components/brand/BrandBookMark'

/**
 * Where an owner or vet gets back in.
 *
 * Not a password screen, because they have never had a password — the link is
 * the credential. This is the "send it again" they would otherwise have to
 * phone the ranch for.
 */
export default function PortalSignInPage() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setState('sending')
    try {
      await fetch('/api/portal/request-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } catch {
      // Deliberately swallowed: the screen says the same thing either way, so
      // that a failure here cannot be used to find out who has an account.
    }
    setState('sent')
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4" style={{ background: 'var(--surface-0)' }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-4 mb-8 text-center">
          <BrandBookMark size={56} color="var(--accent)" />
          <div>
            <h1 className="type-page-title" style={{ color: 'var(--text)' }}>YOUR PORTAL</h1>
            <p className="type-page-subtitle mt-1">No password — we send you a link</p>
          </div>
        </div>

        <div className="rounded-[var(--radius-xl)] p-6"
             style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          {state === 'sent' ? (
            <div className="flex flex-col gap-4">
              <ContextBanner tone="success">
                If that address is on file, the link is on its way. It is good for 30 minutes.
              </ContextBanner>
              <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
                Nothing came through? Check the junk folder, then ask the ranch — they can send
                it to you directly.
              </p>
              <Button intent="ghost" onClick={() => { setState('idle'); setEmail('') }}>
                TRY ANOTHER ADDRESS
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <Field label="Your email" helper="The address the ranch has for you">
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </Field>
              <Button type="submit" intent="primary" size="lg" block loading={state === 'sending'}>
                SEND MY LINK
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
