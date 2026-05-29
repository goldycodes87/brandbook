'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { apiGet } from '@/lib/fetch'

type FeedItem = {
  type: 'health' | 'weight' | 'animal' | 'repro'
  date: string
  label: string
  sub?: string | null
  animal?: { id: string; tag_number: string; name: string | null } | null
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr + 'T12:00:00').getTime()
  const days = Math.floor(ms / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

const TYPE_COLOR: Record<string, string> = {
  health: 'var(--danger-fg)',
  weight: 'var(--accent)',
  animal: 'var(--success-fg)',
  repro:  'var(--gold-fg)',
}

export function ActivityFeed() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet('/api/dashboard/activity')
      .then(r => r.json())
      .then(d => setItems(d.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 rounded-[var(--radius-md)] animate-pulse" style={{ backgroundColor: 'var(--surface-2)' }} />
        ))}
      </div>
    )
  }

  if (!items.length) {
    return (
      <p className="p-6 text-center type-body" style={{ color: 'var(--text-muted)' }}>
        No activity yet. Add your first animal to get started.
      </p>
    )
  }

  return (
    <div className="flex flex-col">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: i < items.length - 1 ? '1px solid var(--border)' : undefined }}
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: TYPE_COLOR[item.type] ?? 'var(--text-muted)' }}
          />
          <div className="flex-1 min-w-0">
            <p className="type-data-sm capitalize truncate">
              {item.label}{item.sub ? ` — ${item.sub}` : ''}
            </p>
            {item.animal && (
              <Link
                href={`/animals/${item.animal.id}`}
                className="type-helper hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                #{item.animal.tag_number}{item.animal.name ? ` — ${item.animal.name}` : ''}
              </Link>
            )}
          </div>
          <span className="type-helper shrink-0" style={{ color: 'var(--text-muted)' }}>
            {timeAgo(item.date)}
          </span>
        </div>
      ))}
    </div>
  )
}
