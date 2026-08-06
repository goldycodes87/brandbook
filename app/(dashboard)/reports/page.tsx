'use client'

import { useState, useEffect } from 'react'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { apiGet, apiPost } from '@/lib/fetch'
import { cn } from '@/lib/utils'
import { DollarSign, BarChart2, MapPin, Beef, User, Download, AlertTriangle } from 'lucide-react'

type ReportType = 'schedule_f' | 'pl' | 'grazing' | 'herd' | 'owner_summary'

const REPORT_TYPES = [
  {
    type: 'schedule_f' as ReportType,
    label: 'Schedule F',
    desc: 'IRS farm income & expenses by line number',
    icon: DollarSign,
    ownerScoped: true,
    excludeSelf: true,
  },
  {
    type: 'pl' as ReportType,
    label: 'Financial P&L',
    desc: 'Sales income vs. expenses, net profit/loss',
    icon: BarChart2,
    ownerScoped: true,
    excludeSelf: false,
  },
  {
    type: 'grazing' as ReportType,
    label: 'Grazing Summary',
    desc: 'Per-owner billing totals for the year',
    icon: MapPin,
    ownerScoped: false,
    excludeSelf: false,
  },
  {
    type: 'herd' as ReportType,
    label: 'Herd / Repro / Health',
    desc: 'Active herd, reproduction, and health stats',
    icon: Beef,
    ownerScoped: false,
    excludeSelf: false,
  },
  {
    type: 'owner_summary' as ReportType,
    label: 'Owner Summary',
    desc: 'Annual report: herd, sales, and settlement',
    icon: User,
    ownerScoped: true,
    excludeSelf: false,
  },
] as const

interface Owner {
  id: string
  name: string
  company_name: string | null
  owner_name: string | null
  is_self: boolean | null
}

function ownerLabel(o: Owner): string {
  return o.company_name || o.owner_name || o.name
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i)

export default function ReportsPage() {
  const [selectedType, setSelectedType] = useState<ReportType>('schedule_f')
  const [owners, setOwners]             = useState<Owner[]>([])
  const [ownerId, setOwnerId]           = useState('')
  const [year, setYear]                 = useState(CURRENT_YEAR)
  const [loading, setLoading]           = useState(false)
  const [pdfUrl, setPdfUrl]             = useState<string | null>(null)
  const [error, setError]               = useState<string | null>(null)

  const reportDef = REPORT_TYPES.find(r => r.type === selectedType)!

  useEffect(() => {
    apiGet('/api/grazing-owners')
      .then(r => r.json())
      .then(d => setOwners(d.data ?? []))
      .catch(() => {})
  }, [])

  // Reset owner and result when type changes
  useEffect(() => {
    setOwnerId('')
    setPdfUrl(null)
    setError(null)
  }, [selectedType])

  const filteredOwners = reportDef.excludeSelf
    ? owners.filter(o => !o.is_self)
    : owners

  async function handleGenerate() {
    if (reportDef.ownerScoped && !ownerId) {
      setError('Please select an owner.')
      return
    }
    setLoading(true)
    setPdfUrl(null)
    setError(null)
    try {
      const res = await apiPost('/api/reports/generate', {
        type:      selectedType,
        owner_id:  reportDef.ownerScoped ? ownerId : undefined,
        year,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Generation failed')
      setPdfUrl(json.pdf_url)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageContainer>
      <PageHeader title="Reports" />

      {/* Report type picker */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 px-4 pt-2">
        {REPORT_TYPES.map(rt => {
          const Icon = rt.icon
          const active = selectedType === rt.type
          return (
            <button
              key={rt.type}
              onClick={() => setSelectedType(rt.type)}
              className={cn(
                'flex flex-col items-start gap-2 p-3 rounded-xl border text-left transition-colors',
                active
                  ? 'bg-brand-orange/10 border-brand-orange text-brand-orange'
                  : 'bg-brand-surface-2 border-brand-gray/20 text-brand-white/60 hover:border-brand-gray/40 hover:text-brand-white',
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold leading-tight">{rt.label}</div>
                <div className="text-xs text-brand-white/40 mt-0.5 leading-snug">{rt.desc}</div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Controls */}
      <div className="px-4 pt-5 space-y-4 max-w-lg">
        {/* Year selector */}
        <div>
          <label className="block text-xs font-medium text-brand-white/50 mb-1.5 uppercase tracking-wider">Year</label>
          <select
            value={year}
            onChange={e => { setYear(Number(e.target.value)); setPdfUrl(null); setError(null) }}
            className="w-full bg-brand-surface-2 border border-brand-gray/30 rounded-lg px-3 py-2.5 text-sm text-brand-white focus:outline-none focus:border-brand-orange"
          >
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Owner selector (for owner-scoped reports) */}
        {reportDef.ownerScoped && (
          <div>
            <label className="block text-xs font-medium text-brand-white/50 mb-1.5 uppercase tracking-wider">Owner</label>
            <select
              value={ownerId}
              onChange={e => { setOwnerId(e.target.value); setPdfUrl(null); setError(null) }}
              className="w-full bg-brand-surface-2 border border-brand-gray/30 rounded-lg px-3 py-2.5 text-sm text-brand-white focus:outline-none focus:border-brand-orange"
            >
              <option value="">— Select owner —</option>
              {filteredOwners.map(o => (
                <option key={o.id} value={o.id}>{ownerLabel(o)}</option>
              ))}
            </select>
          </div>
        )}

        {/* Schedule F note */}
        {selectedType === 'schedule_f' && (
          <div className="flex gap-2 bg-amber-900/20 border border-amber-700/40 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300 leading-relaxed">
              Livestock sales income is limited until the Sale flow captures owner attribution directly.
              Verify Line 1 & 2 figures against your sales records.
            </p>
          </div>
        )}

        {/* Generate button */}
        <Button
          intent="primary"
          size="md"
          block
          loading={loading}
          onClick={handleGenerate}
        >
          {loading ? 'Generating…' : 'Generate PDF'}
        </Button>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Download link */}
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 w-full justify-center px-4 py-3 bg-green-900/20 border border-green-700/40 rounded-xl text-sm font-semibold text-green-400 hover:bg-green-900/30 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </a>
        )}
      </div>
    </PageContainer>
  )
}
