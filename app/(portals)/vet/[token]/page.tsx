'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { apiGet, apiPost } from '@/lib/fetch'

type State = 'loading' | 'setup' | 'authenticating' | 'error'

export default function VetPortalEntryPage() {
  const params    = useParams<{ token: string }>()
  const router    = useRouter()
  const token     = params.token

  const [state, setState]             = useState<State>('loading')
  const [errorMsg, setErrorMsg]       = useState('')
  const [inviteName, setInviteName]   = useState('')

  // Setup form
  const [name, setName]               = useState('')
  const [practiceName, setPracticeName] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [saving, setSaving]           = useState(false)

  useEffect(() => {
    async function verify() {
      try {
        const res  = await apiGet(`/api/vet/verify?token=${encodeURIComponent(token)}`)
        const data = await res.json()
        if (!res.ok) { setState('error'); setErrorMsg(data.error ?? 'Invalid link'); return }
        if (data.isAuthenticated) {
          router.replace('/vet/dashboard')
          return
        }
        if (data.needsSetup) {
          setInviteName(data.invite?.name ?? '')
          setName(data.invite?.name ?? '')
          setPracticeName(data.invite?.practice_name ?? '')
          setState('setup')
        } else {
          // Already set up but not authenticated — auto-login by POSTing setup again? No.
          // The session cookie may have expired. Show setup so they can re-auth.
          setState('authenticating')
        }
      } catch {
        setState('error')
        setErrorMsg('Connection error')
      }
    }
    verify()
  }, [token, router])

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await apiPost('/api/vet/setup', { token, name, practice_name: practiceName, license_number: licenseNumber })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error ?? 'Setup failed'); return }
      router.replace('/vet/dashboard')
    } catch {
      setErrorMsg('Connection error')
    } finally {
      setSaving(false)
    }
  }

  const handleReauth = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await apiPost('/api/vet/setup', { token, name: name || 'Vet', practice_name: practiceName })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error ?? 'Login failed'); return }
      router.replace('/vet/dashboard')
    } catch {
      setErrorMsg('Connection error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="min-h-dvh flex items-center justify-center p-6"
      style={{ backgroundColor: 'var(--surface-0)' }}
    >
      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <div className="flex items-end justify-center gap-0 leading-none mb-8">
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, color: 'var(--accent)' }}>BRAND</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 400, color: 'var(--text)' }}>BOOK</span>
        </div>

        {state === 'loading' && (
          <div className="text-center">
            <div className="h-8 w-8 mx-auto rounded-full animate-pulse" style={{ backgroundColor: 'var(--surface-2)' }} />
            <p className="type-helper mt-3" style={{ color: 'var(--text-muted)' }}>Verifying your access link…</p>
          </div>
        )}

        {state === 'error' && (
          <div
            className="rounded-[var(--radius-lg)] p-5 text-center"
            style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}
          >
            <p className="type-panel-title mb-1" style={{ color: 'var(--danger-fg)' }}>Access Denied</p>
            <p className="type-helper" style={{ color: 'var(--danger-fg)' }}>{errorMsg}</p>
          </div>
        )}

        {(state === 'setup' || state === 'authenticating') && (
          <div
            className="rounded-[var(--radius-xl)] p-6"
            style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}
          >
            <p className="type-panel-title mb-1">
              {state === 'setup' ? 'Welcome to the Vet Portal' : 'Re-enter Vet Portal'}
            </p>
            <p className="type-helper mb-5" style={{ color: 'var(--text-muted)' }}>
              {state === 'setup'
                ? 'Complete your profile to get started'
                : 'Confirm your details to regain access'}
            </p>

            <form onSubmit={state === 'setup' ? handleSetup : handleReauth} className="flex flex-col gap-4">
              <Field label="Your name" required>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={inviteName || 'Dr. Jane Smith'}
                  autoFocus
                />
              </Field>
              <Field label="Practice name">
                <Input
                  value={practiceName}
                  onChange={e => setPracticeName(e.target.value)}
                  placeholder="Valley Veterinary Clinic"
                />
              </Field>
              {state === 'setup' && (
                <Field label="License number">
                  <Input
                    value={licenseNumber}
                    onChange={e => setLicenseNumber(e.target.value)}
                    placeholder="Optional"
                  />
                </Field>
              )}

              {errorMsg && (
                <p className="type-helper px-3 py-2 rounded-[var(--radius-md)]"
                  style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
                  {errorMsg}
                </p>
              )}

              <Button type="submit" intent="primary" loading={saving}>
                {state === 'setup' ? 'ACCESS VET PORTAL' : 'SIGN IN'}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
