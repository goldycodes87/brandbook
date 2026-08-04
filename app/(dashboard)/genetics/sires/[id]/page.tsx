'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel, PanelSection } from '@/components/ui/Panel'
import { Chip } from '@/components/ui/Chip'
import { Skeleton } from '@/components/ui/Skeleton'
import { apiGet } from '@/lib/fetch'

interface SireLibrary {
  id: string
  bull_name: string
  bull_type: string
  breed: string | null
  naab_code: string | null
  stud: string | null
  registration_number: string | null
  birth_year: number | null
  is_active: boolean | null
  photo_url: string | null
  notes: string | null
  epd_source: string | null
  epd_ced: number | null
  epd_bw: number | null
  epd_ww: number | null
  epd_yw: number | null
  epd_milk: number | null
  epd_tm: number | null
  epd_cw: number | null
  epd_rea: number | null
  epd_fat: number | null
  epd_marbling: number | null
  epd_dollar_w: number | null
  epd_dollar_f: number | null
  epd_dollar_g: number | null
  epd_dollar_b: number | null
  acc_bw: number | null
  acc_ww: number | null
  acc_yw: number | null
}

interface InventoryRow {
  id: string
  sire_library_id: string | null
  straw_count: number
  straw_size: string | null
  is_sexed: boolean
  price_per_straw: number | null
  tank_name: string | null
  canister: string | null
  cane: string | null
}

function fmtEpd(n: number | null | undefined): string {
  if (n == null) return '—'
  return n > 0 ? `+${n}` : String(n)
}

function fmtDollar(n: number | null | undefined): string {
  if (n == null) return '—'
  return `$${n.toFixed(2)}`
}

export default function SireDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [sire, setSire] = useState<SireLibrary | null>(null)
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    Promise.all([
      apiGet(`/api/genetics/sires/${id}`).then(r => r.json()),
      apiGet('/api/genetics/tank').then(r => r.json()),
    ]).then(([sireData, tankData]) => {
      if (sireData?.error) { setNotFound(true); setLoading(false); return }
      setSire(sireData)
      const allRows: InventoryRow[] = tankData.data ?? []
      setInventory(allRows.filter(row => row.sire_library_id === id))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <PageContainer>
        <Skeleton h={32} w={256} className="mb-2" />
        <Skeleton h={16} w={128} className="mb-6" />
        <div className="flex flex-col gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} h={80} />)}
        </div>
      </PageContainer>
    )
  }

  if (notFound || !sire) {
    return (
      <PageContainer>
        <PageHeader title="Bull not found" />
        <Link href="/genetics" className="type-helper" style={{ color: 'var(--accent)' }}>← Back to Genetics</Link>
      </PageContainer>
    )
  }

  const totalStraws = inventory.reduce((s, r) => s + (r.straw_count ?? 0), 0)

  const epds = [
    { label: 'CED',      value: sire.epd_ced },
    { label: 'BW',       value: sire.epd_bw },
    { label: 'WW',       value: sire.epd_ww },
    { label: 'YW',       value: sire.epd_yw },
    { label: 'Milk',     value: sire.epd_milk },
    { label: 'TM',       value: sire.epd_tm },
    { label: 'CW',       value: sire.epd_cw },
    { label: 'Marbling', value: sire.epd_marbling },
    { label: 'REA',      value: sire.epd_rea },
    { label: 'Fat',      value: sire.epd_fat },
  ].filter(e => e.value != null)

  const dollars = [
    { label: '$W', value: sire.epd_dollar_w },
    { label: '$F', value: sire.epd_dollar_f },
    { label: '$G', value: sire.epd_dollar_g },
    { label: '$B', value: sire.epd_dollar_b },
  ].filter(e => e.value != null)

  return (
    <PageContainer>
      <PageHeader
        eyebrow={<Link href="/genetics" style={{ color: 'var(--text-muted)' }}>Genetics</Link>}
        title={sire.bull_name}
        subtitle={sire.breed ?? undefined}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {sire.bull_type === 'ai' && (
              <span
                className="type-helper px-1.5 py-0.5 rounded"
                style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent)', fontSize: '10px' }}
              >
                AI SIRE
              </span>
            )}
            {sire.is_active === false && <Chip tone="neutral" size="sm">INACTIVE</Chip>}
          </div>
        }
      />

      <div className="flex flex-col gap-5 md:max-w-3xl">
        {/* Info */}
        <Panel title="BULL INFO">
          <PanelSection>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              {[
                { k: 'NAAB Code',    v: sire.naab_code ?? '—' },
                { k: 'Stud',         v: sire.stud ?? '—' },
                { k: 'Birth Year',   v: sire.birth_year != null ? String(sire.birth_year) : '—' },
                { k: 'Registration', v: sire.registration_number ?? '—' },
                { k: 'EPD Source',   v: sire.epd_source ?? '—' },
              ].map(({ k, v }) => (
                <div key={k}>
                  <dt className="type-field-label mb-0.5" style={{ color: 'var(--text-muted)' }}>{k}</dt>
                  <dd className="type-data-sm">{v}</dd>
                </div>
              ))}
            </dl>
          </PanelSection>
        </Panel>

        {/* Inventory */}
        <Panel title={`STRAWS IN TANK — ${totalStraws} total`}>
          <PanelSection>
            {inventory.length === 0 ? (
              <p className="type-body" style={{ color: 'var(--text-muted)' }}>No straws on inventory</p>
            ) : (
              <div className="flex flex-col gap-2">
                {inventory.map(row => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-[var(--radius-md)]"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="type-data-sm font-semibold" style={{ color: 'var(--accent)' }}>
                        {row.straw_count} straws
                      </span>
                      {row.is_sexed && <Chip tone="info" size="sm">SEXED</Chip>}
                      {row.straw_size && <Chip tone="neutral" size="sm">{row.straw_size}</Chip>}
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      {row.tank_name && (
                        <span className="type-helper" style={{ color: 'var(--text-muted)' }}>{row.tank_name}</span>
                      )}
                      {row.price_per_straw != null && (
                        <span className="type-helper" style={{ color: 'var(--text-secondary)' }}>
                          ${row.price_per_straw}/straw
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PanelSection>
        </Panel>

        {/* EPDs */}
        {(epds.length > 0 || dollars.length > 0) && (
          <Panel title="EPDs">
            <PanelSection>
              {epds.length > 0 && (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 mb-4">
                  {epds.map(({ label, value }) => (
                    <div
                      key={label}
                      className="text-center rounded-lg p-2.5"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                    >
                      <div
                        className="type-section-label"
                        style={{ color: 'var(--text-muted)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em' }}
                      >
                        {label}
                      </div>
                      <div className="type-data-sm font-semibold mt-0.5">{fmtEpd(value)}</div>
                    </div>
                  ))}
                </div>
              )}
              {dollars.length > 0 && (
                <>
                  <p className="type-section-label mb-2" style={{ color: 'var(--text-muted)' }}>
                    SELECTION INDEXES
                  </p>
                  <div className="grid grid-cols-4 gap-3">
                    {dollars.map(({ label, value }) => (
                      <div
                        key={label}
                        className="text-center rounded-lg p-2.5"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                      >
                        <div
                          className="type-section-label"
                          style={{ color: 'var(--text-muted)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em' }}
                        >
                          {label}
                        </div>
                        <div className="type-data-sm font-semibold mt-0.5">{fmtDollar(value)}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {sire.epd_source && (
                <p className="type-helper mt-3" style={{ color: 'var(--text-muted)' }}>
                  Source: {sire.epd_source}
                </p>
              )}
            </PanelSection>
          </Panel>
        )}

        {/* Notes */}
        {sire.notes && (
          <Panel title="NOTES">
            <PanelSection>
              <p className="type-body" style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                {sire.notes}
              </p>
            </PanelSection>
          </Panel>
        )}
      </div>
    </PageContainer>
  )
}
