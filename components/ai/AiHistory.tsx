'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { apiGet } from '@/lib/fetch'

/**
 * Earlier conversations, grouped by the day they happened.
 *
 * Grouped rather than listed because a date is how somebody remembers a
 * conversation — "the day we preg checked" — and a flat list of forty titles
 * is a wall.
 */

interface Row { id: string; title: string; when: string }

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  if (same(d, today))     return 'Today'
  if (same(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

export function AiHistory({ onClose, onPick }: { onClose: () => void; onPick: (id: string) => void }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet('/api/rancher-ai/conversations')
      .then(r => r.json())
      .then(j => { setRows(j.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Escape closes it, the way every other overlay on a laptop does.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const groups: Array<[string, Row[]]> = []
  for (const row of rows) {
    const label = dayLabel(row.when)
    const last = groups[groups.length - 1]
    if (last && last[0] === label) last[1].push(row)
    else groups.push([label, [row]])
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'var(--surface-0)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Earlier conversations"
    >
      <div
        className="flex items-center justify-between px-4"
        style={{
          minHeight: 56,
          borderBottom: '1px solid var(--border)',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>EARLIER</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex items-center justify-center"
          style={{ width: 44, height: 44, color: 'var(--text-muted)' }}
        >
          <X size={18} />
        </button>
      </div>

      <div
        className="flex-1 overflow-y-auto px-4 py-3"
        style={{ paddingBottom: 'calc(var(--safe-pb) + 16px)' }}
      >
        {loading && <p className="type-body" style={{ color: 'var(--text-muted)' }}>Loading…</p>}

        {!loading && rows.length === 0 && (
          <p className="type-body" style={{ color: 'var(--text-muted)' }}>
            Nothing yet. Conversations show up here once you have had one.
          </p>
        )}

        {groups.map(([label, items]) => (
          <div key={label} className="mb-5">
            <p className="type-section-label mb-2" style={{ color: 'var(--text-muted)' }}>
              {label.toUpperCase()}
            </p>
            <div className="flex flex-col gap-2">
              {items.map(row => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onPick(row.id)}
                  className="text-left px-4 py-3 rounded-[var(--radius-lg)]"
                  style={{
                    minHeight: 44,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                >
                  <span className="text-sm block truncate">{row.title}</span>
                  <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{time(row.when)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
