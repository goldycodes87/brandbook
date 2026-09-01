'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Panel, PanelSection } from '@/components/ui/Panel'
import { Field, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { apiPatch } from '@/lib/fetch'

/**
 * Setting a password.
 *
 * Opens by itself when somebody arrives from a sign-in link (?set-password=1),
 * because at that moment it is the only reason they are here — they could not
 * remember the old one, and being dropped on a settings page to go looking for
 * this panel is how people put it off and end up locked out again.
 */
export function PasswordPanel() {
  // Read from the router rather than an effect: reaching for
  // window.location in useEffect means a setState the linter rightly flags,
  // and a first paint with the panel shut before it snaps open.
  const params = useSearchParams()
  const arrivedFromLink = params.has('set-password')
  const [opened, setOpened] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const open = dismissed ? false : (opened || arrivedFromLink)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState('')

  const tooShort = password.length > 0 && password.length < 12
  const mismatch = confirm.length > 0 && password !== confirm

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Those two do not match.'); return }
    setSaving(true)
    try {
      const res = await apiPatch('/api/settings/password', { password })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error ?? 'That did not save'); return }
      setSaved(true)
      setPassword(''); setConfirm('')
      setTimeout(() => { setSaved(false); setDismissed(true) }, 2500)
    } catch {
      setError('Connection error — nothing was changed.')
    } finally { setSaving(false) }
  }

  return (
    <Panel title="PASSWORD" subtitle="How you sign in on this device and any other">
      <PanelSection>
        {saved && <ContextBanner tone="success">Password changed. It works from your next sign-in on.</ContextBanner>}
        {error && <ContextBanner tone="danger">{error}</ContextBanner>}

        {!open && !saved && (
          <Button intent="ghost" onClick={() => setOpened(true)}>CHANGE MY PASSWORD</Button>
        )}

        {open && !saved && (
          <form onSubmit={save} className="flex flex-col gap-4">
            <Field
              label="New password"
              helper="At least 12 characters. A short sentence you will remember beats a clever short one."
              error={tooShort ? 'A bit longer — 12 characters or more.' : undefined}
            >
              <Input
                type="password"
                autoComplete="new-password"
                value={password}
                invalid={tooShort}
                onChange={e => setPassword(e.target.value)}
              />
            </Field>
            <Field label="Type it again" error={mismatch ? 'These do not match yet.' : undefined}>
              <Input
                type="password"
                autoComplete="new-password"
                value={confirm}
                invalid={mismatch}
                onChange={e => setConfirm(e.target.value)}
              />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" intent="primary"
                      disabled={password.length < 12 || password !== confirm}
                      loading={saving}>
                SAVE PASSWORD
              </Button>
              <Button type="button" intent="ghost"
                      onClick={() => { setDismissed(true); setPassword(''); setConfirm(''); setError('') }}>
                CANCEL
              </Button>
            </div>
          </form>
        )}
      </PanelSection>
    </Panel>
  )
}
