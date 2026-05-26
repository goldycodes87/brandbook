'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Sign in failed')
        return
      }
      window.location.href = '/dashboard'
    } catch {
      setError('Connection error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh grid md:grid-cols-2">
      {/* Brand side */}
      <div
        className="hidden md:flex flex-col items-center justify-center p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #0a0a0a 0%, #1a0f06 50%, #0a0a0a 100%)' }}
      >
        {/* Grain texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative z-10 text-center animate-fade-in">
          <div className="mb-8">
            <h1 className="text-6xl font-bold font-display tracking-tight">
              <span className="text-brand-orange">Brand</span>
              <span className="text-brand-white">Book</span>
            </h1>
            <p className="mt-3 text-brand-white/40 text-lg tracking-wider uppercase text-sm">
              By ranchers, for ranchers
            </p>
          </div>
          <div className="flex items-center gap-3 justify-center text-brand-white/20 text-sm">
            <span>🐄</span>
            <span>Ranch OS</span>
            <span>🌾</span>
          </div>
        </div>
      </div>

      {/* Login form side */}
      <div className="flex items-center justify-center p-6 md:p-12 bg-brand-black">
        <div className="w-full max-w-sm animate-slide-up">
          {/* Mobile wordmark */}
          <div className="md:hidden text-center mb-8">
            <h1 className="text-4xl font-bold font-display">
              <span className="text-brand-orange">Brand</span>
              <span className="text-brand-white">Book</span>
            </h1>
            <p className="mt-1 text-brand-white/40 text-xs tracking-wider uppercase">
              By ranchers, for ranchers
            </p>
          </div>

          <div className="bg-brand-surface rounded-2xl p-8 border border-brand-gray/20">
            <h2 className="text-2xl font-bold text-brand-white mb-1">Welcome back</h2>
            <p className="text-brand-white/40 text-sm mb-7">Sign in to your ranch</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@ranch.com"
                autoComplete="email"
                required
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />

              {error && (
                <p className="text-sm text-red-400 bg-red-900/20 border border-red-900/30 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                className="w-full mt-1"
              >
                Sign in
              </Button>

              <button
                type="button"
                className="text-sm text-brand-white/30 hover:text-brand-white/60 transition-colors text-center mt-1"
              >
                Forgot password?
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
