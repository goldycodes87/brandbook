'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Panel, PanelSection } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { Download } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/fetch'

// Moved from Settings → Data, which every user could reach. Import, export
// and cleanup are the three ways to change a lot of records at once, so the
// room they live in is gated on canManageData — admin only.
// ─── Data Cleanup Panel ───────────────────────────────────────────────────────

interface MismatchedAnimal {
  id: string
  tag_number: string
  name: string | null
  sex: string | null
  calf_sex: string | null
}

function DataCleanupPanel() {
  const [animals, setAnimals]     = useState<MismatchedAnimal[]>([])
  const [loading, setLoading]     = useState(true)
  const [fixing, setFixing]       = useState(false)
  const [result, setResult]       = useState<string | null>(null)

  const load = useCallback(async () => {
    const d = await apiGet('/api/settings/data-cleanup').then(r => r.json())
    setAnimals(Array.isArray(d.data) ? d.data : [])
  }, [])

  // Written out rather than routed through `load` — a setState the linter can
  // trace back into an effect body is the cascading render it exists to catch.
  useEffect(() => {
    apiGet('/api/settings/data-cleanup')
      .then(r => r.json())
      .then(d => { setAnimals(Array.isArray(d.data) ? d.data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleFixAll = async () => {
    if (!confirm(`Fix ${animals.length} animal${animals.length !== 1 ? 's' : ''}? This will update their sex to match their recorded calf_sex.`)) return
    setFixing(true); setResult(null)
    try {
      const res  = await apiPost('/api/settings/data-cleanup', { auto_fix: true })
      const json = await res.json()
      setResult(`Fixed ${json.updated} animal${json.updated !== 1 ? 's' : ''}.`)
      await load()
    } catch { setResult('Error — please try again') }
    finally { setFixing(false) }
  }

  return (
    <Panel title="DATA CLEANUP" subtitle="Animals with inconsistent sex vs. calf sex records">
      <PanelSection>
        {loading ? (
          <p className="type-body" style={{ color: 'var(--text-muted)' }}>Scanning…</p>
        ) : animals.length === 0 ? (
          <ContextBanner tone="success">No sex mismatches found — data looks clean.</ContextBanner>
        ) : (
          <>
            <ContextBanner tone="warning" eyebrow={`${animals.length} MISMATCH${animals.length !== 1 ? 'ES' : ''}`}>
              These animals have a <strong>calf_sex</strong> that does not match their current <strong>sex</strong>. Fix All sets sex to match calf_sex (heifer_calf → heifer, bull_calf → bull).
            </ContextBanner>
            <div className="mt-3 flex flex-col gap-1.5">
              {animals.map(a => (
                <div key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-[var(--radius-md)]"
                  style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <div>
                    <span className="type-data-sm font-semibold" style={{ color: 'var(--accent)' }}>#{a.tag_number}</span>
                    {a.name && <span className="type-helper ml-2" style={{ color: 'var(--text-muted)' }}>{a.name}</span>}
                    <span className="type-helper ml-2" style={{ color: 'var(--text-muted)' }}>
                      sex: <strong>{a.sex}</strong> · calf_sex: <strong>{a.calf_sex}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <Button intent="primary" size="sm" loading={fixing} onClick={handleFixAll}>
                FIX ALL ({animals.length})
              </Button>
            </div>
          </>
        )}
        {result && (
          <p className="type-helper mt-2" style={{ color: 'var(--success-fg)' }}>{result}</p>
        )}
      </PanelSection>
    </Panel>
  )
}

// ─── Data Tab ─────────────────────────────────────────────────────────────────

export function DataRoom() {
  const csvRef = useRef<HTMLInputElement>(null)
  const [csvFile, setCsvFile]         = useState<File | null>(null)
  const [importing, setImporting]     = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)
  const [importError, setImportError] = useState('')

  const handleImport = async () => {
    if (!csvFile) return
    setImporting(true)
    setImportResult(null)
    setImportError('')
    try {
      const fd = new FormData()
      fd.append('csv', csvFile)
      const res  = await apiPost('/api/animals/bulk-import', fd)
      const json = await res.json()
      if (!res.ok) { setImportError(json.error ?? 'Import failed'); return }
      setImportResult(json)
      setCsvFile(null)
      if (csvRef.current) csvRef.current.value = ''
    } catch {
      setImportError('Connection error')
    } finally {
      setImporting(false)
    }
  }

  const exports = [
    { label: 'Animals', description: 'All animals with tags, breed, status', href: '/api/export/animals' },
    { label: 'Weight history', description: 'All recorded weights by animal', href: '/api/export/weights' },
    { label: 'Health events', description: 'Health logs, treatments, withdrawals', href: '/api/export/health' },
    { label: 'Sales records', description: 'Sale transactions and proceeds', href: '/api/export/sales' },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Bulk Import */}
      <Panel title="BULK ANIMAL IMPORT">
        <PanelSection>
          <ContextBanner tone="info">
            Fill in the template and upload to import multiple animals at once.
          </ContextBanner>

          <div className="mt-4 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <a href="/templates/animals-import-template.csv" download>
                <Button intent="ghost" size="sm" leading={<Download size={14} />}>
                  DOWNLOAD TEMPLATE
                </Button>
              </a>
              <span className="type-helper" style={{ color: 'var(--text-muted)' }}>animals-import-template.csv</span>
            </div>

            <input
              ref={csvRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => { setCsvFile(e.target.files?.[0] ?? null); setImportResult(null); setImportError('') }}
            />

            {csvFile ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <span className="type-data-sm truncate">{csvFile.name}</span>
                <button type="button" className="type-helper" style={{ color: 'var(--accent)' }} onClick={() => { setCsvFile(null); if (csvRef.current) csvRef.current.value = '' }}>change</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => csvRef.current?.click()}
                className="w-full px-4 py-5 rounded-lg border-2 border-dashed text-center"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                <div className="type-field-label mb-0.5">TAP TO SELECT CSV FILE</div>
                <div className="type-helper">.csv format only</div>
              </button>
            )}

            {importError && (
              <p className="type-helper px-3 py-2 rounded" style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
                {importError}
              </p>
            )}

            {importResult && (
              <ContextBanner tone={importResult.imported > 0 ? 'success' : 'warning'} eyebrow="IMPORT COMPLETE">
                <strong>{importResult.imported}</strong> animal{importResult.imported !== 1 ? 's' : ''} imported
                {importResult.skipped > 0 && `, ${importResult.skipped} skipped`}.
                {importResult.errors.length > 0 && (
                  <ul className="mt-1 list-disc list-inside">
                    {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </ContextBanner>
            )}

            <Button intent="primary" size="sm" disabled={!csvFile} loading={importing} onClick={handleImport}>
              IMPORT ANIMALS
            </Button>
          </div>
        </PanelSection>
      </Panel>

      {/* Export Data */}
      <Panel title="EXPORT DATA">
        <PanelSection>
          <p className="type-body mb-4" style={{ color: 'var(--text-secondary)' }}>
            Download your data as CSV files. Exports include all records for your ranch.
          </p>
          <div className="flex flex-col gap-3">
            {exports.map(ex => (
              <div key={ex.href} className="flex items-center justify-between py-2"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                  <p className="type-field-label" style={{ color: 'var(--text)' }}>{ex.label}</p>
                  <p className="type-helper mt-0.5" style={{ color: 'var(--text-muted)' }}>{ex.description}</p>
                </div>
                <a href={ex.href} download>
                  <Button intent="secondary" size="sm">DOWNLOAD CSV</Button>
                </a>
              </div>
            ))}
          </div>
        </PanelSection>
      </Panel>

      <DataCleanupPanel />
    </div>
  )
}
