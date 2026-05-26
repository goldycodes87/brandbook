'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'

export default function InvitePage() {
  const [name, setName]         = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')

  return (
    <div
      className="min-h-dvh flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--surface-0)' }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-end gap-0 leading-none mb-2">
            <span
              className="font-bold select-none"
              style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', color: 'var(--accent)' }}
            >
              BRAND
            </span>
            <span
              className="font-normal select-none"
              style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', color: 'var(--text)' }}
            >
              BOOK
            </span>
          </div>
        </div>

        <div
          className="rounded-[var(--radius-xl)] p-8"
          style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
        >
          <h2
            className="mb-1"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.5rem',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--text)',
            }}
          >
            You&apos;ve been invited
          </h2>
          <p className="type-page-subtitle mb-6">Set up your account to get started</p>

          <form onSubmit={e => e.preventDefault()} className="flex flex-col gap-4">
            <Input
              label="Full name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Jane Rancher"
              autoComplete="name"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
            <Input
              label="Confirm password"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
            <Button type="submit" intent="primary" size="lg" block className="mt-1">
              ACCEPT INVITE
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
