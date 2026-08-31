'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Mail, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { AddOwnerSheet, type GrazingOwner } from '@/components/settings/AddOwnerSheet'
import { apiGet } from '@/lib/fetch'

// Moved from Settings → Custom Grazing. Same endpoints, same sheet: only the
// expense categories stayed behind, because they belong with Billing & Rates
// and that room is being moved last.

const EAR_TAG_COLORS = [
  { name: 'Yellow',  hex: '#F5C518' },
  { name: 'Orange',  hex: '#F97316' },
  { name: 'White',   hex: '#F3F4F6' },
  { name: 'Green',   hex: '#22C55E' },
  { name: 'Blue',    hex: '#3B82F6' },
  { name: 'Red',     hex: '#EF4444' },
  { name: 'Pink',    hex: '#EC4899' },
  { name: 'Purple',  hex: '#A855F7' },
  { name: 'Silver',  hex: '#9CA3AF' },
  { name: 'Black',   hex: '#1F2937' },
]

interface GrazingContract {
  id: string
  owner_id: string | null
  is_active: boolean | null
  calf_share_pct: number | null
  death_loss_allowable_pct: number | null
  death_loss_split_threshold_pct: number | null
  sale_fee_auction_pct: number | null
  sale_fee_private_flat: number | null
}

export function OwnersRoom() {
  const [owners, setOwners]       = useState<GrazingOwner[]>([])
  const [contracts, setContracts] = useState<Record<string, GrazingContract>>({})
  const [loading, setLoading]     = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing]     = useState<GrazingOwner | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [inviting, setInviting]   = useState<string | null>(null)
  const [inviteMsg, setInviteMsg] = useState<{ id: string; msg: string } | null>(null)

  const load = useCallback(async () => {
    const [ownersData, contractsData] = await Promise.all([
      apiGet('/api/grazing-owners').then(r => r.json()),
      apiGet('/api/grazing-owners/contracts').then(r => r.json()),
    ])
    setOwners(Array.isArray(ownersData.data) ? ownersData.data : [])
    const map: Record<string, GrazingContract> = {}
    for (const c of (contractsData.data ?? [])) {
      if (c.owner_id) map[c.owner_id] = c
    }
    setContracts(map)
  }, [])

  // Written out here rather than routed through `load`: a setState the linter
  // can trace back into an effect body is the cascading render it exists to
  // catch, even behind a promise.
  useEffect(() => {
    Promise.all([
      apiGet('/api/grazing-owners').then(r => r.json()),
      apiGet('/api/grazing-owners/contracts').then(r => r.json()),
    ]).then(([ownersData, contractsData]) => {
      setOwners(Array.isArray(ownersData.data) ? ownersData.data : [])
      const map: Record<string, GrazingContract> = {}
      for (const c of (contractsData.data ?? [])) {
        if (c.owner_id) map[c.owner_id] = c
      }
      setContracts(map)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleSendInvite = async (ownerId: string) => {
    setInviting(ownerId); setInviteMsg(null)
    try {
      const res  = await fetch(`/api/billing/owners/${ownerId}/invite`, { method: 'POST' })
      const json = await res.json()
      setInviteMsg({ id: ownerId, msg: res.ok ? 'Invite sent!' : (json.error ?? 'Send failed') })
    } catch {
      setInviteMsg({ id: ownerId, msg: 'Connection error' })
    } finally {
      setInviting(null)
      setTimeout(() => setInviteMsg(null), 3000)
    }
  }

  if (loading) return <p className="type-body" style={{ color: 'var(--text-muted)' }}>Loading…</p>

  return (
    <div className="flex flex-col gap-6 pb-8">
      <div className="flex items-center justify-between">
        <p className="type-section-label" style={{ color: 'var(--text-muted)' }}>
          {owners.length} OWNER{owners.length !== 1 ? 'S' : ''}
        </p>
        <Button intent="primary" size="sm" onClick={() => { setEditing(null); setSheetOpen(true) }}>
          + ADD OWNER
        </Button>
      </div>

      {deleteError && (
        <p className="type-helper px-3 py-2 rounded" style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
          {deleteError}
          <button type="button" className="ml-2 underline" onClick={() => setDeleteError('')}>dismiss</button>
        </p>
      )}

      {owners.length === 0 ? (
        <EmptyState
          variant="neutral"
          title="No custom grazing owners"
          body="Add cattle owners to track their animals separately and generate invoices."
          action={<Button intent="primary" size="sm" onClick={() => { setEditing(null); setSheetOpen(true) }}>+ ADD OWNER</Button>}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {owners.map(owner => {
            const tagColor = EAR_TAG_COLORS.find(c => c.name === owner.default_ear_tag_color)
            const isThisInviting = inviting === owner.id
            const thisMsg = inviteMsg?.id === owner.id ? inviteMsg.msg : null
            return (
              <div
                key={owner.id}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-[var(--radius-lg)]"
                style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {tagColor && (
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tagColor.hex, border: '1px solid var(--border-strong)' }}
                      title={tagColor.name}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>
                      {owner.company_name || owner.owner_name || owner.name}
                    </p>
                    <p className="type-helper truncate" style={{ color: 'var(--text-muted)' }}>
                      {owner.company_name && owner.owner_name && (
                        <span className="mr-1">{owner.owner_name} ·</span>
                      )}
                      {[owner.email, owner.phone].filter(Boolean).join(' · ')}
                      {owner.default_breed && <span className="ml-1">· {owner.default_breed}</span>}
                    </p>
                    {(() => {
                      const c = contracts[owner.id]
                      if (c) return (
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <Chip tone="success" size="sm">CONTRACT</Chip>
                          <span className="type-helper" style={{ color: 'var(--text-muted)' }}>
                            {c.calf_share_pct != null && `Calf share: ${c.calf_share_pct}% · `}
                            Death loss: {c.death_loss_allowable_pct ?? 10}% / {c.death_loss_split_threshold_pct ?? 25}%
                            {c.sale_fee_auction_pct != null && ` · Sale fee: ${c.sale_fee_auction_pct}% auction`}
                          </span>
                          <Link href={`/settings/grazing/${owner.id}/contract`} className="type-helper font-semibold" style={{ color: 'var(--accent)' }}>
                            VIEW →
                          </Link>
                        </div>
                      )
                      return (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Chip tone="neutral" size="sm">NO CONTRACT</Chip>
                          <button type="button" className="type-helper font-semibold" style={{ color: 'var(--accent)' }}
                            onClick={() => { setEditing(owner); setSheetOpen(true) }}>
                            SET UP CONTRACT
                          </button>
                        </div>
                      )
                    })()}
                    {thisMsg && (
                      <p className="type-helper" style={{ color: thisMsg === 'Invite sent!' ? 'var(--success-fg)' : 'var(--danger-fg)' }}>
                        {thisMsg}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {owner.email && (
                    <Button
                      intent="ghost" size="sm"
                      loading={isThisInviting}
                      onClick={() => handleSendInvite(owner.id)}
                      leading={<Mail size={13} />}
                    >
                      PORTAL INVITE
                    </Button>
                  )}
                  <Button
                    intent="ghost" size="sm"
                    onClick={() => { setEditing(owner); setSheetOpen(true) }}
                    leading={<Pencil size={13} />}
                  >
                    EDIT
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AddOwnerSheet
        isOpen={sheetOpen}
        onClose={() => { setSheetOpen(false); setEditing(null) }}
        onSuccess={load}
        initialData={editing}
        mode={editing ? 'edit' : 'create'}
      />
    </div>
  )
}
