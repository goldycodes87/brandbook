'use client'

import { useState, useEffect } from 'react'
import { Panel, PanelSection } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { ContextBanner } from '@/components/ui/ContextBanner'
import Badge from '@/components/ui/Badge'
import { apiGet } from '@/lib/fetch'

interface Row {
  name: string
  group: string
  purpose: string
  blocks: string
  required: boolean
  set: boolean
}

/**
 * What this deployment is actually configured with.
 *
 * Presence only — the API never returns a value, so nothing here can leak a
 * key. It exists because there is no way to read a Vercel environment from
 * outside it, and "is it set in production?" was a question nobody could
 * answer without opening the dashboard and squinting.
 */
export function ConfigCheck() {
  const [rows, setRows] = useState<Row[]>([])
  const [env, setEnv]   = useState('')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    apiGet('/api/admin/config-check')
      .then(r => r.json())
      .then(j => { setRows(j.data ?? []); setEnv(j.environment ?? ''); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return null

  const missing = rows.filter(r => r.required && !r.set)
  const groups = [...new Set(rows.map(r => r.group))]

  return (
    <Panel
      title="CONFIGURATION"
      subtitle={`${rows.filter(r => r.set).length} of ${rows.length} set · ${env}`}
    >
      <PanelSection>
        {missing.length === 0 ? (
          <ContextBanner tone="success">
            Everything the app needs is set here.
          </ContextBanner>
        ) : (
          <ContextBanner tone="warning" eyebrow={`${missing.length} MISSING`}>
            <ul className="mt-1 flex flex-col gap-1">
              {[...new Set(missing.map(m => m.blocks).filter(Boolean))].map(b => (
                <li key={b} className="type-helper">· {b}</li>
              ))}
            </ul>
          </ContextBanner>
        )}

        <div className="mt-3">
          <Button intent="ghost" size="sm" onClick={() => setOpen(!open)}>
            {open ? 'HIDE THE LIST' : 'SHOW EVERY VARIABLE'}
          </Button>
        </div>

        {open && (
          <div className="mt-4 flex flex-col gap-5">
            {groups.map(g => (
              <div key={g}>
                <p className="type-section-label mb-2" style={{ color: 'var(--text-muted)' }}>
                  {g.toUpperCase()}
                </p>
                <div className="flex flex-col gap-2">
                  {rows.filter(r => r.group === g).map(r => (
                    <div key={r.name}
                         className="flex flex-wrap items-start justify-between gap-2 py-1.5"
                         style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <div className="min-w-0">
                        <code className="type-data-sm" style={{ color: r.set ? 'var(--text)' : 'var(--text-muted)' }}>
                          {r.name}
                        </code>
                        <p className="type-helper" style={{ color: 'var(--text-muted)' }}>{r.purpose}</p>
                        {!r.set && r.blocks && (
                          <p className="type-helper" style={{ color: 'var(--warning-fg, var(--gold-fg))' }}>
                            {r.blocks}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        {r.set
                          ? <Badge variant="success">Set</Badge>
                          : r.required
                            ? <Badge variant="warning">Missing</Badge>
                            : <Badge variant="neutral">Optional</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
              Values are never shown here — only whether something is set. Changing one in
              Vercel needs a redeploy before it takes effect.
            </p>
          </div>
        )}
      </PanelSection>
    </Panel>
  )
}
