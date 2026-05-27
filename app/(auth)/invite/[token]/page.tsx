'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Chip } from '@/components/ui/Chip'

interface InviteInfo {
  valid: boolean
  name?: string
  email?: string
  role?: string
  ranch_name?: string
  error?: string
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()

  const [info, setInfo]         = useState<InviteInfo | null>(null)
  const [name, setName]         = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/invite/verify?token=${token}`)
      .then(r => r.json())
      .then(data => {
        setInfo(data)
        if (data.name) setName(data.name)
        setLoading(false)
      })
      .catch(() => { setInfo({ valid: false, error: 'Failed to verify invite' }); setLoading(false) })
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to accept invite'); return }
      router.push('/dashboard')
    } catch {
      setError('Connection error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  const roleLabel = info?.role?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? ''

  return (
    <div className="min-h-dvh flex items-center justify-center p-4" style={{ backgroundColor: 'var(--surface-0)' }}>
      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-end gap-0 leading-none mb-2">
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 700, color: 'var(--accent)' }}>BRAND</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 400, color: 'var(--text)' }}>BOOK</span>
          </div>
        </div>

        <div className="rounded-[var(--radius-xl)] p-8" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>

          {loading && (
            <p className="type-body text-center" style={{ color: 'var(--text-muted)' }}>Verifying invite…</p>
          )}

          {!loading && !info?.valid && (
            <>
              <h2 className="mb-2" style={{ color: 'var(--danger-fg)', fontSize: '1.1rem', fontWeight: 600 }}>Invite invalid</h2>
              <p className="type-body" style={{ color: 'var(--text-muted)' }}>{info?.error ?? 'This invite link is invalid or has expired.'}</p>
            </>
          )}

          {!loading && info?.valid && (
            <>
              <p className="type-section-label mb-1" style={{ color: 'var(--text-muted)' }}>INVITATION</p>
              <h2 className="mb-1" style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 600, color: 'var(--text)' }}>
                You&apos;ve been invited
              </h2>
              <p className="type-body mb-1" style={{ color: 'var(--text-secondary)' }}>
                {info.ranch_name} has invited you to join Brand Book.
              </p>
              {info.role && (
                <div className="mb-5">
                  <Chip tone="accent" size="sm">{roleLabel}</Chip>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Field label="Full name" required>
                  <Input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Jane Rancher"
                    autoComplete="name"
                    required
                  />
                </Field>
                <Field label="Password" required helper="Minimum 8 characters">
                  <Input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                  />
                </Field>
                <Field label="Confirm password" required>
                  <Input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                  />
                </Field>

                {error && (
                  <p className="text-sm px-3 py-2 rounded-[var(--radius-md)]"
                    style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
                    {error}
                  </p>
                )}

                <Button type="submit" intent="primary" size="lg" block loading={submitting} className="mt-1">
                  ACCEPT INVITATION
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
