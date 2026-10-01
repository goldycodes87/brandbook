'use client'

import { useState, useEffect } from 'react'
import { NOTIFY_COPY, type NotifySettings } from '@/lib/notify-preferences'

/**
 * What the ranch may email you about.
 *
 * Saves on the switch rather than behind a Save button: there is nothing here
 * to get half-right, and a settings panel that silently discards a change
 * because somebody navigated away is worse than no panel. The switch moves at
 * once and rolls back if the write fails, so what is on screen is always what
 * is in the database.
 */
export function NotificationSettings() {
  const [settings, setSettings] = useState<NotifySettings | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    let off = false
    fetch('/api/portals/owner/notifications', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (!off && d.data) setSettings(d.data) })
      .catch(() => {})
      .finally(() => { if (!off) setLoading(false) })
    return () => { off = true }
  }, [])

  const toggle = async (key: keyof NotifySettings) => {
    if (!settings) return
    const next = { ...settings, [key]: !settings[key] }
    setSettings(next)
    setError(null)

    try {
      const res = await fetch('/api/portals/owner/notifications', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next[key] }),
      })
      if (!res.ok) throw new Error()
      const d = await res.json()
      if (d.data) setSettings(d.data)
    } catch {
      setSettings(settings)   // put it back where it was
      setError('That did not save. Try again.')
    }
  }

  if (loading)   return <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>Loading…</p>
  if (!settings) return <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>Preferences are not available.</p>

  const master = settings.contact_email

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 4 }}>
      <Switch
        title="Email me"
        detail="The master switch. Off, and the ranch will not email you at all — including about money."
        on={master}
        onToggle={() => toggle('contact_email')}
      />

      <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />

      {/* Dimmed rather than hidden when the master is off: an owner should be
          able to see what he is turning down, and find his settings where he
          left them when he turns it back on. */}
      <div style={{ opacity: master ? 1 : 0.42, pointerEvents: master ? 'auto' : 'none' }}>
        {NOTIFY_COPY.map(c => (
          <Switch
            key={c.key}
            title={c.title}
            detail={c.detail}
            on={settings[c.key] as boolean}
            onToggle={() => toggle(c.key)}
          />
        ))}
      </div>

      {error && (
        <p style={{ fontSize: 12, color: 'var(--warning-fg)', margin: '8px 0 0' }}>{error}</p>
      )}

      <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '10px 0 2px', lineHeight: 1.6 }}>
        Everything is in your portal whether it is emailed or not.
      </p>
    </div>
  )
}

function Switch({ title, detail, on, onToggle }: {
  title: string; detail: string; on: boolean; onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%',
        padding: '11px 0', background: 'none', border: 'none', textAlign: 'left',
        cursor: 'pointer', color: 'inherit',
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
          {title}
        </span>
        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>
          {detail}
        </span>
      </span>

      <span
        aria-hidden="true"
        style={{
          flexShrink: 0, marginTop: 2, width: 42, height: 24, borderRadius: 999,
          background: on ? 'var(--accent)' : 'var(--surface-3)',
          border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
          position: 'relative', transition: 'background 140ms ease',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: on ? 20 : 2,
          width: 18, height: 18, borderRadius: '50%',
          background: on ? '#fff' : 'var(--text-muted)',
          transition: 'left 140ms ease',
        }} />
      </span>
    </button>
  )
}
