'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { Field, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { apiPost } from '@/lib/fetch'

interface ExtractedBull {
  bull_name: string
  naab_code: string | null
  registration_number: string | null
  breed: string | null
  birth_year: number | null
  epd_bw: number | null
  epd_ww: number | null
  epd_yw: number | null
  epd_milk: number | null
  epd_dollar_b: number | null
}

type Step = 'upload' | 'review' | 'done'

function EpdVal({ v }: { v: number | null }) {
  if (v == null) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  return <span>{v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)}</span>
}

export function GeneticsImportClient() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep]           = useState<Step>('upload')
  const [stud, setStud]           = useState('')
  const [file, setFile]           = useState<File | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractStatus, setExtractStatus] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [error, setError]         = useState('')
  const [bulls, setBulls]         = useState<ExtractedBull[]>([])
  const [selected, setSelected]   = useState<Set<number>>(new Set())
  const [pdfUrl, setPdfUrl]       = useState<string | null>(null)
  const [pdfFilename, setPdfFilename] = useState<string | null>(null)
  const [importedCount, setImportedCount] = useState(0)

  const toggleAll = () => {
    if (selected.size === bulls.length) setSelected(new Set())
    else setSelected(new Set(bulls.map((_, i) => i)))
  }

  const toggleRow = (i: number) => {
    const next = new Set(selected)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    setSelected(next)
  }

  const handleExtract = async () => {
    if (!file) return
    setExtracting(true)
    setError('')
    try {
      // Step 1: get presigned PUT URL
      setExtractStatus('Preparing upload…')
      const presignRes = await apiPost('/api/genetics/import/presign', {
        filename:    file.name,
        contentType: file.type,
      })
      const presignJson = await presignRes.json()
      if (!presignRes.ok) { setError(presignJson.error ?? 'Could not prepare upload'); return }
      const { url, key } = presignJson

      // Step 2: upload directly to R2 (bypasses Vercel body limit)
      setExtractStatus('Uploading PDF to storage…')
      const uploadRes = await fetch(url, {
        method:  'PUT',
        body:    file,
        headers: { 'Content-Type': file.type },
      })
      if (!uploadRes.ok) { setError('Upload to storage failed. Try again.'); return }

      // Step 3: extract bulls via AI
      setExtractStatus('AI is reading the sire directory…')
      const processRes  = await apiPost('/api/genetics/import/process', { key, stud })
      const json = await processRes.json()
      if (!processRes.ok) { setError(json.error ?? 'Extraction failed'); return }

      setBulls(json.bulls ?? [])
      setPdfUrl(json.pdf_url)
      setPdfFilename(json.pdf_filename)
      setSelected(new Set((json.bulls ?? []).map((_: unknown, i: number) => i)))
      setStep('review')
    } catch (error: unknown) {
      const err = error as { message?: string }
      if (err.message?.includes('Session expired') || err.message?.includes('307')) {
        setError('Session expired. Refresh the page and try again.')
      } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        setError('Network error. Check your connection and try again.')
      } else {
        setError(err.message || 'Upload failed. Check Vercel logs for details.')
      }
    } finally {
      setExtracting(false)
      setExtractStatus('')
    }
  }

  const handleConfirm = async () => {
    const selectedBulls = bulls.filter((_, i) => selected.has(i))
    if (selectedBulls.length === 0) return

    setConfirming(true)
    setError('')
    try {
      const res  = await apiPost('/api/genetics/import/confirm', { stud, pdf_url: pdfUrl, pdf_filename: pdfFilename, bulls: selectedBulls })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Import failed'); return }
      setImportedCount(json.imported)
      setStep('done')
    } catch {
      setError('Connection error')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Import Sire Catalog"
        actions={
          <Button intent="ghost" size="sm" onClick={() => router.push('/genetics')}>
            BACK TO LIBRARY
          </Button>
        }
      />

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="flex flex-col gap-5 max-w-lg">
          <Panel>
            <div className="flex flex-col gap-4">
              <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
                Upload a PDF or image from a stud catalog. AI will extract bull names, NAAB codes, and EPD values automatically.
              </p>

              <Field label="Stud / AI company" helper="e.g. ABS, Select Sires, Accelerated Genetics">
                <Input
                  value={stud}
                  onChange={e => setStud(e.target.value)}
                  placeholder="ABS"
                />
              </Field>

              <Field label="Catalog file" helper="PDF or image (JPG, PNG)">
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                />
                {file ? (
                  <div
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                  >
                    <span className="type-data-sm truncate">{file.name}</span>
                    <button
                      type="button"
                      className="type-helper"
                      style={{ color: 'var(--accent)' }}
                      onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }}
                    >
                      change
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full px-4 py-6 rounded-lg border-2 border-dashed transition-colors text-center"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                  >
                    <div className="type-field-label mb-1">TAP TO SELECT FILE</div>
                    <div className="type-helper">PDF, JPG, or PNG</div>
                  </button>
                )}
              </Field>

              {error && (
                <p
                  className="type-helper px-3 py-2 rounded"
                  style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}
                >
                  {error}
                </p>
              )}

              {extractStatus && (
                <p className="type-helper text-center" style={{ color: 'var(--text-muted)' }}>
                  {extractStatus}
                </p>
              )}

              <Button
                intent="primary"
                onClick={handleExtract}
                loading={extracting}
                disabled={!file}
              >
                EXTRACT BULLS
              </Button>
            </div>
          </Panel>
        </div>
      )}

      {/* Step 2: Review */}
      {step === 'review' && (
        <div className="flex flex-col gap-4">
          <ContextBanner tone="info" eyebrow="EXTRACTION COMPLETE">
            Found {bulls.length} bull{bulls.length !== 1 ? 's' : ''}. Review and deselect any you don&apos;t want to import.
          </ContextBanner>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.size === bulls.length}
                onChange={toggleAll}
                className="w-4 h-4"
                style={{ accentColor: 'var(--accent)' }}
              />
              <span className="type-field-label">Select all ({selected.size} / {bulls.length})</span>
            </label>
            <Button intent="ghost" size="sm" onClick={() => setStep('upload')}>BACK</Button>
          </div>

          <div className="flex flex-col gap-2">
            {bulls.map((bull, i) => (
              <div
                key={i}
                className="flex items-start gap-3 px-3 py-2.5 rounded-lg cursor-pointer"
                style={{
                  background: selected.has(i) ? 'var(--accent-bg)' : 'var(--surface-1)',
                  border: `1px solid ${selected.has(i) ? 'var(--accent)' : 'var(--border)'}`,
                }}
                onClick={() => toggleRow(i)}
              >
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => toggleRow(i)}
                  onClick={e => e.stopPropagation()}
                  className="mt-0.5 w-4 h-4 flex-shrink-0"
                  style={{ accentColor: 'var(--accent)' }}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{bull.bull_name}</div>
                  <div className="type-helper flex flex-wrap gap-x-2.5 gap-y-0.5 mt-0.5">
                    {bull.naab_code && <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{bull.naab_code}</span>}
                    {bull.breed && <span style={{ color: 'var(--text-muted)' }}>{bull.breed}</span>}
                    {bull.birth_year && <span style={{ color: 'var(--text-muted)' }}>{bull.birth_year}</span>}
                  </div>
                  <div className="type-helper flex flex-wrap gap-x-3 gap-y-0.5 mt-1" style={{ color: 'var(--text-muted)' }}>
                    {bull.epd_bw != null && <span>BW <EpdVal v={bull.epd_bw} /></span>}
                    {bull.epd_ww != null && <span>WW <EpdVal v={bull.epd_ww} /></span>}
                    {bull.epd_yw != null && <span>YW <EpdVal v={bull.epd_yw} /></span>}
                    {bull.epd_milk != null && <span>Milk <EpdVal v={bull.epd_milk} /></span>}
                    {bull.epd_dollar_b != null && <span style={{ color: 'var(--accent)' }}>$B <EpdVal v={bull.epd_dollar_b} /></span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {error && (
            <p
              className="type-helper px-3 py-2 rounded"
              style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}
            >
              {error}
            </p>
          )}

          <Button
            intent="primary"
            onClick={handleConfirm}
            loading={confirming}
            disabled={selected.size === 0}
          >
            IMPORT {selected.size} SIRE{selected.size !== 1 ? 'S' : ''}
          </Button>
        </div>
      )}

      {/* Step 3: Done */}
      {step === 'done' && (
        <div className="flex flex-col gap-4 max-w-sm">
          <ContextBanner tone="success" emphasis eyebrow="IMPORT COMPLETE">
            <strong>{importedCount}</strong> sire{importedCount !== 1 ? 's' : ''} added to your library.
          </ContextBanner>
          <Button intent="primary" onClick={() => router.push('/genetics')}>
            VIEW LIBRARY
          </Button>
          <Button intent="ghost" onClick={() => { setStep('upload'); setFile(null); setBulls([]); setError('') }}>
            IMPORT ANOTHER
          </Button>
        </div>
      )}
    </PageContainer>
  )
}
