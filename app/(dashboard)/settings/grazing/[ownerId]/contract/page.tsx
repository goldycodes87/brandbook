'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel, PanelSection } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table'
import { AddOwnerSheet, type GrazingOwner } from '@/components/settings/AddOwnerSheet'
import { apiGet } from '@/lib/fetch'
import { ChevronLeft, Pencil, FileText } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GrazingContract {
  id: string
  owner_id: string
  is_active: boolean
  effective_date: string | null
  expiration_date: string | null
  calf_share_pct: number | null
  calf_share_rounding: string | null
  calf_selection_method: string | null
  calf_transfer_basis: string | null
  carry_forward_shortfall: boolean | null
  calf_shortfall_carried: number | null
  shortfall_from_year: number | null
  death_loss_allowable_pct: number | null
  death_loss_split_threshold_pct: number | null
  sale_fee_auction_pct: number | null
  sale_fee_private_flat: number | null
  billing_cycle: string | null
  expense_share_method: string | null
  expense_share_pct: number | null
  rate_per_head_month: number | null
  notes: string | null
  created_at: string
}

interface Settlement {
  id: string
  settlement_year: number
  calves_born: number | null
  calves_weaned: number | null
  calves_died: number | null
  operator_calf_share: number | null
  owner_calf_share: number | null
  balance_due_to_operator: number | null
  balance_due_to_owner: number | null
  is_settled: boolean | null
  pdf_url: string | null
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, prefix = '', suffix = '') {
  if (v == null) return '—'
  return `${prefix}${v}${suffix}`
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtMoney(v: number | null | undefined) {
  if (v == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
}

function LabelValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="type-label" style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span className="type-body" style={{ fontWeight: 500 }}>{value ?? '—'}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContractPage({ params }: { params: Promise<{ ownerId: string }> }) {
  const { ownerId } = use(params)
  const router = useRouter()

  const [owner, setOwner]           = useState<GrazingOwner | null>(null)
  const [contract, setContract]     = useState<GrazingContract | null>(null)
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [loading, setLoading]       = useState(true)
  const [sheetOpen, setSheetOpen]   = useState(false)

  const currentYear = new Date().getFullYear()

  const load = useCallback(async () => {
    const [ownerRes, contractRes, settlementRes] = await Promise.all([
      apiGet(`/api/grazing-owners/${ownerId}`).then(r => r.json()),
      apiGet(`/api/grazing-owners/${ownerId}/contract`).then(r => r.json()),
      apiGet(`/api/grazing-owners/${ownerId}/settlement`).then(r => r.json()),
    ])
    setOwner(ownerRes.data ?? null)
    setContract(contractRes.data ?? null)
    setSettlements(settlementRes.data ?? [])
    setLoading(false)
  }, [ownerId])

  useEffect(() => { load() }, [load])

  const currentYearSettlement = settlements.find(s => s.settlement_year === currentYear) ?? null

  if (loading) {
    return (
      <PageContainer>
        <p className="type-body" style={{ color: 'var(--text-muted)' }}>Loading…</p>
      </PageContainer>
    )
  }

  const hasCalf = contract?.calf_share_pct != null

  return (
    <PageContainer>
      {/* Back nav */}
      <Link
        href="/settings"
        className="flex items-center gap-1 type-label"
        style={{ color: 'var(--text-muted)', marginBottom: '8px', textDecoration: 'none' }}
      >
        <ChevronLeft size={14} />
        Back to Settings
      </Link>

      <PageHeader
        title={owner?.name ?? 'Grazing Owner'}
        subtitle="Contract &amp; Settlement"
        actions={
          <Button
            intent="secondary"
            size="sm"
            onClick={() => setSheetOpen(true)}
            leading={<Pencil size={14} />}
          >
            EDIT CONTRACT
          </Button>
        }
      />

      {/* Contract details */}
      {contract ? (
        <Panel title="ACTIVE CONTRACT">
          <PanelSection>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
              <LabelValue label="Effective date"   value={fmtDate(contract.effective_date)} />
              <LabelValue label="Expiration date"  value={fmtDate(contract.expiration_date)} />
              <LabelValue label="Rate / head / mo" value={fmtMoney(contract.rate_per_head_month)} />
              <LabelValue label="Billing cycle"    value={contract.billing_cycle ?? '—'} />
              <LabelValue label="Auction fee"      value={fmt(contract.sale_fee_auction_pct, '', '%')} />
              <LabelValue label="Private flat fee" value={fmtMoney(contract.sale_fee_private_flat)} />
            </div>
          </PanelSection>

          {hasCalf && (
            <PanelSection>
              <p className="type-label" style={{ color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '11px' }}>Calf Share</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
                <LabelValue label="Operator share"     value={fmt(contract.calf_share_pct, '', '%')} />
                <LabelValue label="Rounding"           value={contract.calf_share_rounding ?? '—'} />
                <LabelValue label="Selection method"   value={contract.calf_selection_method ?? '—'} />
                <LabelValue label="Transfer basis"     value={contract.calf_transfer_basis ?? '—'} />
                <LabelValue label="Carry shortfall"    value={contract.carry_forward_shortfall ? 'Yes' : 'No'} />
                {(contract.calf_shortfall_carried ?? 0) > 0 && (
                  <LabelValue
                    label="Current shortfall"
                    value={`${contract.calf_shortfall_carried} calves (from ${contract.shortfall_from_year ?? '—'})`}
                  />
                )}
              </div>
            </PanelSection>
          )}

          <PanelSection>
            <p className="type-label" style={{ color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '11px' }}>Death Loss</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
              <LabelValue label="Owner allowable"   value={fmt(contract.death_loss_allowable_pct, '', '%')} />
              <LabelValue label="Split threshold"   value={fmt(contract.death_loss_split_threshold_pct, '', '%')} />
            </div>
            <div style={{ marginTop: '12px' }}>
              <ContextBanner tone="info">
                {'≤'}{contract.death_loss_allowable_pct ?? 10}% → owner bears loss &nbsp;·&nbsp;
                {contract.death_loss_allowable_pct ?? 10}–{contract.death_loss_split_threshold_pct ?? 25}% → split 50/50 &nbsp;·&nbsp;
                {'>'}{contract.death_loss_split_threshold_pct ?? 25}% → operator bears loss
              </ContextBanner>
            </div>
          </PanelSection>

          {contract.notes && (
            <PanelSection>
              <LabelValue label="Notes" value={<span style={{ whiteSpace: 'pre-wrap' }}>{contract.notes}</span>} />
            </PanelSection>
          )}
        </Panel>
      ) : (
        <Panel title="CONTRACT">
          <PanelSection>
            <ContextBanner tone="warning">
              No active contract on file for this owner.
            </ContextBanner>
            <div style={{ marginTop: '12px' }}>
              <Button intent="primary" size="sm" onClick={() => setSheetOpen(true)}>
                SET UP CONTRACT
              </Button>
            </div>
          </PanelSection>
        </Panel>
      )}

      {/* Current year settlement */}
      <Panel title={`${currentYear} SETTLEMENT`}>
        <PanelSection>
          {currentYearSettlement ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-5" style={{ marginBottom: '16px' }}>
                <LabelValue label="Calves born"   value={currentYearSettlement.calves_born ?? '—'} />
                <LabelValue label="Calves weaned" value={currentYearSettlement.calves_weaned ?? '—'} />
                <LabelValue label="Operator share" value={currentYearSettlement.operator_calf_share ?? '—'} />
                <LabelValue label="Owner calves"  value={currentYearSettlement.owner_calf_share ?? '—'} />
                <LabelValue
                  label="Balance due operator"
                  value={fmtMoney(currentYearSettlement.balance_due_to_operator)}
                />
                <LabelValue
                  label="Balance due owner"
                  value={fmtMoney(currentYearSettlement.balance_due_to_owner)}
                />
                <LabelValue
                  label="Status"
                  value={
                    <Chip tone={currentYearSettlement.is_settled ? 'success' : 'warning'}>
                      {currentYearSettlement.is_settled ? 'SETTLED' : 'PENDING'}
                    </Chip>
                  }
                />
              </div>
              {currentYearSettlement.pdf_url && (
                <a
                  href={currentYearSettlement.pdf_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 type-label"
                  style={{ color: 'var(--accent)', textDecoration: 'none' }}
                >
                  <FileText size={14} />
                  VIEW ANNUAL REPORT
                </a>
              )}
            </>
          ) : (
            <>
              <p className="type-body" style={{ color: 'var(--text-muted)', marginBottom: '12px' }}>
                No settlement recorded for {currentYear}.
              </p>
            </>
          )}
        </PanelSection>
      </Panel>

      {/* Settlement history */}
      {settlements.length > 0 && (
        <Panel title="SETTLEMENT HISTORY">
          <Table>
            <THead>
              <TR>
                <TH>Year</TH>
                <TH>Calves Born</TH>
                <TH>Operator Share</TH>
                <TH>Owner Calves</TH>
                <TH>Balance</TH>
                <TH>Status</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {settlements.map(s => {
                const balance = (s.balance_due_to_operator ?? 0) > 0
                  ? fmtMoney(s.balance_due_to_operator) + ' to operator'
                  : (s.balance_due_to_owner ?? 0) > 0
                    ? fmtMoney(s.balance_due_to_owner) + ' to owner'
                    : 'Even'
                return (
                  <TR key={s.id}>
                    <TD>{s.settlement_year}</TD>
                    <TD>{s.calves_born ?? '—'}</TD>
                    <TD>{s.operator_calf_share ?? '—'}</TD>
                    <TD>{s.owner_calf_share ?? '—'}</TD>
                    <TD>{balance}</TD>
                    <TD>
                      <Chip tone={s.is_settled ? 'success' : 'warning'}>
                        {s.is_settled ? 'SETTLED' : 'PENDING'}
                      </Chip>
                    </TD>
                    <TD>
                      {s.pdf_url && (
                        <a
                          href={s.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 type-label"
                          style={{ color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}
                        >
                          <FileText size={12} />
                          VIEW →
                        </a>
                      )}
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        </Panel>
      )}

      {/* Edit sheet */}
      {owner && (
        <AddOwnerSheet
          isOpen={sheetOpen}
          mode="edit"
          initialData={owner}
          onClose={() => setSheetOpen(false)}
          onSuccess={() => { setSheetOpen(false); load() }}
        />
      )}
    </PageContainer>
  )
}
