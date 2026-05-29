'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { apiPost } from '@/lib/fetch'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res  = await apiPost('/api/auth/session', { email, password })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Sign in failed'); return }
      window.location.href = '/dashboard'
    } catch {
      setError('Connection error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-dvh flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--surface-0)' }}
    >
      <div className="w-full max-w-sm">
        {/* Brand mark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-end gap-0 leading-none mb-2">
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.01em' }}>
              BRAND
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', fontWeight: 400, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              BOOK
            </span>
          </div>
          <p className="type-page-subtitle mb-3">By ranchers, for ranchers</p>
          <div className="mx-auto rounded-full" style={{ width: 40, height: 3, backgroundColor: 'var(--accent)' }} />
        </div>

        {/* Form card */}
        <div
          className="rounded-[var(--radius-xl)] p-8"
          style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
        >
          <h2
            className="mb-6"
            style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text)' }}
          >
            Welcome back
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Email" required>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@ranch.com"
                autoComplete="email"
                required
              />
            </Field>
            <Field label="Password" required>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </Field>

            {error && (
              <p
                className="text-sm px-3 py-2 rounded-[var(--radius-lg)]"
                style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}
              >
                {error}
              </p>
            )}

            <Button type="submit" intent="primary" size="lg" block loading={loading} className="mt-1">
              SIGN IN
            </Button>

            <button
              type="button"
              className="text-center transition-colors duration-150 type-helper hover:text-[var(--text-secondary)]"
              style={{ color: 'var(--text-muted)' }}
            >
              Forgot password?
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
