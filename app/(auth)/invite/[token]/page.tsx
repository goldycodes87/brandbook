'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function InvitePage() {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-brand-black">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold font-display">
            <span className="text-brand-orange">Brand</span>
            <span className="text-brand-white">Book</span>
          </h1>
          <p className="mt-1 text-brand-white/40 text-xs tracking-wider uppercase">
            By ranchers, for ranchers
          </p>
        </div>

        <div className="bg-brand-surface rounded-2xl p-8 border border-brand-gray/20">
          <h2 className="text-2xl font-bold text-brand-white mb-1">You're invited</h2>
          <p className="text-brand-white/40 text-sm mb-7">Set up your account to get started</p>

          <form className="flex flex-col gap-4" onSubmit={e => e.preventDefault()}>
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

            <Button type="submit" variant="primary" size="lg" className="w-full mt-1">
              Create account
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
