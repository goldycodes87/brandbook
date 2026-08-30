'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { BrandDrawingPad } from '@/components/settings/BrandDrawingPad'
import { BrandBookMark } from '@/components/portal/BrandBookMark'
import { apiGet, apiPost } from '@/lib/fetch'
import {
  stepsForRole, HERD_GOALS, OWNER_NOTIFICATIONS, VET_NOTIFICATIONS,
  EAR_TAG_COLORS, VET_SCOPE, defaultNotify,
  type PortalRole, type StepId,
} from '@/lib/onboarding-steps'

interface Draft {
  first_name: string; last_name: string; preferred_name: string
  email: string; phone: string
  contact_email: boolean; contact_text: boolean
  company_name: string
  address: string; city: string; state: string; zip: string
  mail_here: boolean
  brand_image_url: string | null; brand_source: string | null
  default_ear_tag_color: string; default_tag_prefix: string
  goals: string[]
  practice_name: string; license_state: string; license_number: string; license_expires: string
  signature_url: string | null
  notify: Record<string, boolean>
}

const EMPTY: Draft = {
  first_name: '', last_name: '', preferred_name: '', email: '', phone: '',
  contact_email: true, contact_text: false,
  company_name: '', address: '', city: '', state: '', zip: '', mail_here: true,
  brand_image_url: null, brand_source: null,
  default_ear_tag_color: '', default_tag_prefix: '', goals: [],
  practice_name: '', license_state: '', license_number: '', license_expires: '',
  signature_url: null, notify: {},
}

export default function OnboardingPage() {
  const router = useRouter()

  const [role, setRole]     = useState<PortalRole | null>(null)
  const [ranchName, setRanch] = useState('the ranch')
  const [d, setD]           = useState<Draft>(EMPTY)
  const [i, setI]           = useState(0)
  const [loading, setLoad]  = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const steps = role ? stepsForRole(role) : []
  const step  = steps[i]
  const counted = steps.filter(s => s.counts)
  const doneCount = steps.slice(0, i + 1).filter(s => s.counts).length

  const set = (p: Partial<Draft>) => setD(prev => ({ ...prev, ...p }))

  useEffect(() => {
    let off = false
    apiGet('/api/portal/onboarding').then(r => r.json()).then(j => {
      if (off) return
      if (j.error) { setError(j.error); return }
      if (j.onboarded) { router.replace(j.role === 'vet' ? '/vet/dashboard' : '/owner'); return }

      const p = j.person ?? {}, o = j.owner ?? {}, m = j.membership ?? {}
      setRole(j.role)
      setRanch(j.ranch?.ranch_name ?? 'the ranch')
      setD({
        ...EMPTY,
        first_name: p.first_name ?? '', last_name: p.last_name ?? '',
        preferred_name: p.preferred_name ?? '', email: p.email ?? '', phone: p.phone ?? '',
        contact_email: p.contact_email ?? true, contact_text: p.contact_text ?? false,
        company_name: o.company_name ?? '',
        address: o.address ?? '', city: o.city ?? '', state: o.state ?? '', zip: o.zip ?? '',
        mail_here: !o.billing_address,
        brand_image_url: o.brand_image_url ?? null, brand_source: o.brand_source ?? null,
        default_ear_tag_color: o.default_ear_tag_color ?? '',
        default_tag_prefix: o.default_tag_prefix ?? '',
        goals: o.goals ?? [],
        practice_name: p.practice_name ?? '', license_state: p.license_state ?? '',
        license_number: p.license_number ?? '', license_expires: p.license_expires ?? '',
        signature_url: p.signature_url ?? null,
        notify: Object.keys(m.notify ?? {}).length ? m.notify : defaultNotify(j.role),
      })
    }).catch(() => { if (!off) setError('Connection error') })
      .finally(() => { if (!off) setLoad(false) })
    return () => { off = true }
  }, [router])

  /** Save what this step changed, then move. Every step saves, so closing the
   *  app mid-flow loses nothing and reopening lands where you left off. */
  async function next() {
    if (!step) return
    setSaving(true); setError('')
    try {
      const payload = payloadFor(step.id, d, role!)
      if (Object.keys(payload).length > 0) {
        const res = await apiPost('/api/portal/onboarding', payload)
        const j = await res.json()
        if (!res.ok) { setError(j.error ?? 'Could not save that'); return }
      }
      if (step.id === 'review') {
        const res = await apiPost('/api/portal/onboarding', { complete: true })
        if (!res.ok) { setError('Could not finish setting up'); return }
      }
      setI(n => Math.min(n + 1, steps.length - 1))
    } catch {
      setError('Connection error')
    } finally { setSaving(false) }
  }

  if (loading) {
    return <Shell><p style={{ color: 'var(--text-muted)' }}>Loading…</p></Shell>
  }
  if (!role || !step) {
    return <Shell><ContextBanner tone="danger">{error || 'That link is no longer valid.'}</ContextBanner></Shell>
  }

  const notifications = role === 'vet' ? VET_NOTIFICATIONS : OWNER_NOTIFICATIONS

  return (
    <Shell>
      {step.counts && (
        <div className="flex gap-1 mb-1">
          {counted.map((s, n) => (
            <i key={s.id} className="h-[3px] flex-1 rounded"
               style={{ background: n < doneCount ? 'var(--accent)' : 'var(--border)' }} />
          ))}
        </div>
      )}

      {/* ── Welcome ─────────────────────────────────────────────────── */}
      {step.id === 'welcome' && (
        <div className="flex flex-col items-center text-center gap-4 py-6">
          <BrandBookMark size={56} color="var(--accent)" />
          <h1 className="type-page-title" style={{ fontSize: '1.6rem' }}>Welcome to BrandBook</h1>
          <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
            A modern cattle record keeping app.
          </p>
          <div style={{ width: 30, height: 1, background: 'var(--accent)', opacity: .65 }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            You&apos;ve been invited by<br /><strong style={{ color: 'var(--text)' }}>{ranchName}</strong> as {role === 'vet' ? 'a' : 'an'}
          </p>
          <span className="type-helper px-3 py-1 rounded-full"
                style={{ border: '1px solid var(--accent)', color: 'var(--accent)', letterSpacing: '.18em', textTransform: 'uppercase' }}>
            {role === 'co_admin' ? 'Co-admin' : role === 'cpa' ? 'CPA' : role === 'vet' ? 'Veterinarian' : role === 'admin' ? 'Admin' : 'Owner'}
          </span>
          <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
            Let&apos;s {role === 'vet' ? 'get you set up' : 'set up your portal'}.
          </p>
        </div>
      )}

      {step.id !== 'welcome' && step.id !== 'done' && (
        <h1 className="type-page-title" style={{ fontSize: '1.35rem' }}>{step.title}</h1>
      )}

      {/* ── Details ─────────────────────────────────────────────────── */}
      {step.id === 'details' && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <Field label="First"><Input value={d.first_name} onChange={e => set({ first_name: e.target.value })} /></Field>
            <Field label="Last"><Input value={d.last_name} onChange={e => set({ last_name: e.target.value })} /></Field>
          </div>
          {role === 'vet' && (
            <Field label="Practice">
              <Input value={d.practice_name} onChange={e => set({ practice_name: e.target.value })} placeholder="Platte Valley Large Animal" />
            </Field>
          )}
          <Field label="Mobile"><Input value={d.phone} onChange={e => set({ phone: e.target.value })} inputMode="tel" /></Field>
          <Field label="Email"><Input value={d.email} onChange={e => set({ email: e.target.value })} inputMode="email" /></Field>
          <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>How can we reach you</p>
          <Toggle on={d.contact_email} onClick={() => set({ contact_email: !d.contact_email })} icon="✉" label="Email" />
          <Toggle on={d.contact_text}  onClick={() => set({ contact_text: !d.contact_text })}  icon="💬" label="Text" />
        </div>
      )}

      {/* ── Address ─────────────────────────────────────────────────── */}
      {step.id === 'address' && (
        <div className="flex flex-col gap-3">
          <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
            Where you are. Invoices and statements go here unless you tell us otherwise.
          </p>
          <Field label="Street"><Input value={d.address} onChange={e => set({ address: e.target.value })} /></Field>
          <Field label="City"><Input value={d.city} onChange={e => set({ city: e.target.value })} /></Field>
          <div className="flex gap-3">
            <Field label="State"><Input value={d.state} onChange={e => set({ state: e.target.value })} maxLength={2} /></Field>
            <Field label="ZIP"><Input value={d.zip} onChange={e => set({ zip: e.target.value })} inputMode="numeric" /></Field>
          </div>
          <Toggle on={d.mail_here} onClick={() => set({ mail_here: !d.mail_here })}
                  icon="✓" label="Send my mail here too" hint="Uncheck to add a separate billing address" />
        </div>
      )}

      {/* ── Preferred name ──────────────────────────────────────────── */}
      {step.id === 'name' && (
        <div className="flex flex-col gap-3">
          <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
            {[d.first_name, d.last_name].filter(Boolean).join(' ') || 'Your full name'} is what goes on invoices.
            This is just what we say hello with.
          </p>
          <Field label="Goes by"><Input value={d.preferred_name} onChange={e => set({ preferred_name: e.target.value })} placeholder={d.first_name || 'Andy'} /></Field>
          <Field label="Ranch name, if you have one">
            <Input value={d.company_name} onChange={e => set({ company_name: e.target.value })} placeholder="Holloman Cattle Co." />
          </Field>
        </div>
      )}

      {/* ── Brand ───────────────────────────────────────────────────── */}
      {step.id === 'brand' && (
        <div className="flex flex-col gap-3">
          <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
            Photograph the iron, or draw it with your finger. It&apos;ll sit on your reports and beside your cattle.
          </p>
          <BrandDrawingPad
            endpoint="/api/portal/upload-image"
            existingUrl={d.brand_image_url ?? undefined}
            onSave={url => set({ brand_image_url: url, brand_source: 'photo' })}
          />
          <Button intent="ghost" size="sm" onClick={() => { set({ brand_source: 'none' }); next() }}>
            I don&apos;t have one yet
          </Button>
          <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
            You can add it any time from your profile.
          </p>
        </div>
      )}

      {/* ── Tag colour ──────────────────────────────────────────────── */}
      {step.id === 'tags' && (
        <div className="flex flex-col gap-3">
          <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
            How you&apos;ll pick your cattle out of the herd on every screen.
          </p>
          <div className="flex flex-wrap gap-2">
            {EAR_TAG_COLORS.map(c => (
              <button key={c.name} type="button" onClick={() => set({ default_ear_tag_color: c.name })}
                className="w-12 h-12 rounded-lg grid place-items-center text-[10px] font-bold"
                style={{
                  background: c.hex,
                  color: c.name === 'Black' ? '#ECEFEA' : '#0E1210',
                  border: `2px solid ${d.default_ear_tag_color === c.name ? 'var(--accent)' : 'transparent'}`,
                }}>
                {c.name}
              </button>
            ))}
          </div>
          <Field label="Tag prefix — optional">
            <Input value={d.default_tag_prefix} onChange={e => set({ default_tag_prefix: e.target.value })} placeholder="e.g. H — reads H-41" />
          </Field>
        </div>
      )}

      {/* ── Goals ───────────────────────────────────────────────────── */}
      {step.id === 'goals' && (
        <div className="flex flex-col gap-2">
          <p className="type-helper" style={{ color: 'var(--text-muted)' }}>Pick as many as fit.</p>
          {HERD_GOALS.map(g => (
            <Toggle key={g.id} on={d.goals.includes(g.id)} icon={g.emoji} label={g.label} hint={g.hint}
              onClick={() => set({
                goals: d.goals.includes(g.id) ? d.goals.filter(x => x !== g.id) : [...d.goals, g.id],
              })} />
          ))}
        </div>
      )}

      {/* ── Licence ─────────────────────────────────────────────────── */}
      {step.id === 'licence' && (
        <div className="flex flex-col gap-3">
          <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
            Treatment records are signed with this. It shows on the record; it is never shown to owners.
          </p>
          <div className="flex gap-3">
            <Field label="State"><Input value={d.license_state} onChange={e => set({ license_state: e.target.value })} maxLength={2} /></Field>
            <Field label="Licence no."><Input value={d.license_number} onChange={e => set({ license_number: e.target.value })} /></Field>
          </div>
          <Field label="Expires"><Input type="date" value={d.license_expires} onChange={e => set({ license_expires: e.target.value })} /></Field>
          <ContextBanner tone="neutral">
            We&apos;ll nudge you 60 days before this expires — nothing stops working. We don&apos;t ask for or store a DEA number.
          </ContextBanner>
        </div>
      )}

      {/* ── Signature ───────────────────────────────────────────────── */}
      {step.id === 'signature' && (
        <div className="flex flex-col gap-3">
          <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
            Goes on treatment records and health certificates. Draw it once — we&apos;ll apply it when you tap Sign.
          </p>
          <BrandDrawingPad
            endpoint="/api/portal/upload-image"
            existingUrl={d.signature_url ?? undefined}
            labels={{ upload: 'UPLOAD IMAGE', draw: 'DRAW SIGNATURE' }}
            onSave={url => set({ signature_url: url })}
          />
          <ContextBanner tone="neutral">Applied only when you tap Sign. Never auto-attached to anything.</ContextBanner>
        </div>
      )}

      {/* ── Scope ───────────────────────────────────────────────────── */}
      {step.id === 'scope' && (
        <div className="flex flex-col gap-2">
          <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
            Set by {ranchName}. Ask them if you need something that isn&apos;t here.
          </p>
          {VET_SCOPE.map(s => (
            <div key={s.label} className="flex items-center gap-3 px-3 py-2 rounded-lg"
              style={{ border: '1px solid var(--border)', opacity: s.allowed ? 1 : .62 }}>
              <span style={{ color: s.allowed ? 'var(--success-fg)' : 'var(--danger-fg)' }}>{s.allowed ? '✓' : '✕'}</span>
              <span className="text-sm">
                {s.label}
                {'hint' in s && s.hint && (
                  <span className="block type-helper" style={{ color: 'var(--text-muted)' }}>{s.hint}</span>
                )}
              </span>
            </div>
          ))}
          <ContextBanner tone="neutral">
            Owners see your name, your practice, and who gave the treatment.
          </ContextBanner>
        </div>
      )}

      {/* ── Notifications ───────────────────────────────────────────── */}
      {step.id === 'notify' && (
        <div className="flex flex-col gap-2">
          <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
            Anything you turn on sends a push to your phone. Everything else still shows up in the
            app — you just won&apos;t be interrupted for it.
          </p>
          <button type="button" className="type-helper self-end px-3 py-1 rounded-full"
            style={{ border: '1px solid var(--accent)', color: 'var(--accent)' }}
            onClick={() => set({ notify: Object.fromEntries(notifications.map(n => [n.id, true])) })}>
            ALL OF IT
          </button>
          {notifications.map(n => (
            <Toggle key={n.id} on={Boolean(d.notify[n.id])} icon={n.emoji} label={n.label}
              hint={'hint' in n ? n.hint : undefined}
              onClick={() => set({ notify: { ...d.notify, [n.id]: !d.notify[n.id] } })} />
          ))}
        </div>
      )}

      {/* ── Review ──────────────────────────────────────────────────── */}
      {step.id === 'review' && (
        <div className="flex flex-col gap-1">
          <p className="type-helper mb-2" style={{ color: 'var(--text-muted)' }}>Tap any line to change it.</p>
          {reviewRows(d, role, notifications).map(([k, v, target]) => (
            <button key={k} type="button" onClick={() => setI(steps.findIndex(s => s.id === target))}
              className="flex justify-between gap-3 py-2 text-left text-sm"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)', flex: '0 0 88px' }}>{k}</span>
              <span className="flex-1 text-right">{v}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Done ────────────────────────────────────────────────────── */}
      {step.id === 'done' && (
        <div className="flex flex-col items-center text-center gap-4 py-8">
          <BrandBookMark size={44} color="var(--accent)" />
          <h1 className="type-page-title" style={{ fontSize: '1.4rem' }}>
            All set{d.preferred_name ? `, ${d.preferred_name}` : ''}.
          </h1>
          <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
            {role === 'vet' ? 'Your cases are waiting.' : "Here's where you stand."}
          </p>
        </div>
      )}

      {error && <ContextBanner tone="danger">{error}</ContextBanner>}

      <div className="flex gap-3 mt-2">
        {i > 0 && step.id !== 'done' && (
          <Button intent="ghost" size="sm" onClick={() => setI(n => Math.max(0, n - 1))}>BACK</Button>
        )}
        <Button intent="primary" size="sm" className="flex-1" loading={saving}
          onClick={() => step.id === 'done'
            ? router.replace(role === 'vet' ? '/vet/dashboard' : '/owner')
            : next()}>
          {step.id === 'welcome' ? 'BEGIN'
            : step.id === 'review' ? 'FINISH'
            : step.id === 'done' ? (role === 'vet' ? 'SEE MY CASES' : 'SEE MY CATTLE')
            : step.id === 'scope' ? 'UNDERSTOOD'
            : 'NEXT'}
        </Button>
      </div>
    </Shell>
  )
}

// ── bits ──────────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex justify-center" style={{ background: 'var(--surface-0)' }}>
      <div className="w-full max-w-md px-5 py-8 flex flex-col gap-4">{children}</div>
    </div>
  )
}

function Toggle({ on, onClick, icon, label, hint }: {
  on: boolean; onClick: () => void; icon: string; label: string; hint?: string
}) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left w-full"
      style={{
        border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
        background: on ? 'var(--accent-soft, var(--surface-2))' : 'var(--surface-1)',
      }}>
      <span>{icon}</span>
      <span className="text-sm flex-1">
        {label}
        {hint && <span className="block type-helper" style={{ color: 'var(--text-muted)' }}>{hint}</span>}
      </span>
      {on && <span style={{ color: 'var(--accent)' }}>✓</span>}
    </button>
  )
}

/** Only the fields this step touched — a partial save, not the whole draft. */
function payloadFor(id: StepId, d: Draft, role: PortalRole): Record<string, unknown> {
  switch (id) {
    case 'details': return {
      first_name: d.first_name, last_name: d.last_name, phone: d.phone, email: d.email,
      contact_email: d.contact_email, contact_text: d.contact_text,
      ...(role === 'vet' ? { practice_name: d.practice_name } : {}),
    }
    case 'address': return {
      address: d.address, city: d.city, state: d.state, zip: d.zip,
      // Checking the box clears any override rather than leaving a stale one.
      ...(d.mail_here ? { billing_address: null } : {}),
    }
    case 'name':      return { preferred_name: d.preferred_name, company_name: d.company_name }
    case 'brand':     return { brand_image_url: d.brand_image_url, brand_source: d.brand_source ?? (d.brand_image_url ? 'photo' : null) }
    case 'tags':      return { default_ear_tag_color: d.default_ear_tag_color, default_tag_prefix: d.default_tag_prefix }
    case 'goals':     return { goals: d.goals }
    case 'licence':   return { license_state: d.license_state, license_number: d.license_number, license_expires: d.license_expires || null }
    case 'signature': return { signature_url: d.signature_url }
    case 'notify':    return { notify: d.notify }
    default:          return {}
  }
}

function reviewRows(
  d: Draft,
  role: PortalRole,
  notifications: readonly { id: string; label: string }[],
): Array<[string, string, StepId]> {
  const on = notifications.filter(n => d.notify[n.id]).map(n => n.label).join(' · ') || 'Nothing'
  const common: Array<[string, string, StepId]> = [
    ['Name',   [d.first_name, d.last_name].filter(Boolean).join(' ') || '—', 'details'],
    ['Mobile', d.phone || '—', 'details'],
    ['Email',  d.email || '—', 'details'],
  ]
  if (role === 'vet') {
    return [
      ...common,
      ['Practice', d.practice_name || '—', 'details'],
      ['Licence',  [d.license_state, d.license_number].filter(Boolean).join(' · ') || '—', 'licence'],
      ['Expires',  d.license_expires || '—', 'licence'],
      ['Signature', d.signature_url ? 'Saved' : 'Not set', 'signature'],
      ['Push',     on, 'notify'],
    ]
  }
  return [
    ...common,
    ['Goes by', d.preferred_name || '—', 'name'],
    ['Ranch',   d.company_name || '—', 'name'],
    ['Address', [d.address, d.city, d.state].filter(Boolean).join(', ') || '—', 'address'],
    ['Brand',   d.brand_image_url ? 'Saved' : d.brand_source === 'none' ? 'None yet' : 'Not set', 'brand'],
    ['Tags',    d.default_ear_tag_color || '—', 'tags'],
    ['Goals',   HERD_GOALS.filter(g => d.goals.includes(g.id)).map(g => g.label).join(' · ') || 'None', 'goals'],
    ['Push',    on, 'notify'],
  ]
}
