'use client'

import SignatureCanvas from 'react-signature-canvas'
import { useRef, useState } from 'react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Button } from '@/components/ui/Button'
import { ContextBanner } from '@/components/ui/ContextBanner'
import type { SegmentItem } from '@/components/ui/SegmentedControl'

type Mode    = 'upload' | 'draw'
type PenSize = 'sm' | 'md' | 'lg'

const MODE_ITEMS: SegmentItem<Mode>[] = [
  { value: 'upload', label: 'UPLOAD PHOTO' },
  { value: 'draw',   label: 'DRAW BRAND'   },
]

const PEN_ITEMS: SegmentItem<PenSize>[] = [
  { value: 'sm', label: 'SM' },
  { value: 'md', label: 'MD' },
  { value: 'lg', label: 'LG' },
]

const PEN_WIDTHS: Record<PenSize, number> = { sm: 2, md: 4, lg: 8 }

export interface BrandDrawingPadProps {
  onSave: (url: string) => void
  existingUrl?: string
}

function dataURLToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export function BrandDrawingPad({ onSave, existingUrl }: BrandDrawingPadProps) {
  const sigCanvas              = useRef<SignatureCanvas>(null)
  const [mode, setMode]        = useState<Mode>('upload')
  const [penSize, setPenSize]  = useState<PenSize>('md')
  const [saving, setSaving]    = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved]      = useState(false)
  const [error, setError]      = useState('')

  const switchMode = (v: Mode) => { setMode(v); setSaved(false); setError('') }

  const handleClear = () => sigCanvas.current?.clear()

  const handleSaveDrawing = async () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      setError('Draw your brand before saving')
      return
    }
    setSaving(true); setError(''); setSaved(false)
    try {
      const dataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png')
      const blob    = dataURLToBlob(dataUrl)
      const fd      = new FormData()
      fd.append('image', blob, 'brand-drawing.png')
      const res  = await fetch('/api/settings/upload-brand', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Upload failed'); return }
      onSave(data.url)
      setSaved(true)
    } catch {
      setError('Connection error')
    } finally {
      setSaving(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setError(''); setSaved(false)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res  = await fetch('/api/settings/upload-brand', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Upload failed'); return }
      onSave(data.url)
      setSaved(true)
    } catch {
      setError('Connection error')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        items={MODE_ITEMS}
        value={mode}
        onChange={v => switchMode(v as Mode)}
        block
        size="sm"
      />

      {/* ── Upload mode ──────────────────────────────────────────────── */}
      {mode === 'upload' && (
        <div className="flex flex-col gap-3">
          {existingUrl && (
            <div
              className="w-32 h-32 rounded-[var(--radius-md)] overflow-hidden"
              style={{ border: '1px solid var(--border)', backgroundColor: '#fff' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={existingUrl} alt="Current brand" className="object-contain w-full h-full p-2" />
            </div>
          )}
          <label
            className="inline-flex items-center gap-2 cursor-pointer px-3 py-2 rounded-[var(--radius-md)] transition-colors type-button w-fit"
            style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            {uploading ? 'Uploading…' : existingUrl ? 'Replace photo' : 'Upload brand photo'}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
          <p className="type-helper" style={{ color: 'var(--text-muted)' }}>
            PNG, JPG or WEBP. Clear background works best.
          </p>
        </div>
      )}

      {/* ── Draw mode ────────────────────────────────────────────────── */}
      {mode === 'draw' && (
        <div className="flex flex-col gap-3">
          <div style={{ maxWidth: 400, width: '100%' }}>
            <SignatureCanvas
              ref={sigCanvas}
              penColor="black"
              minWidth={PEN_WIDTHS[penSize]}
              maxWidth={PEN_WIDTHS[penSize]}
              canvasProps={{
                width: 400,
                height: 400,
                style: {
                  maxWidth: '100%',
                  display: 'block',
                  cursor: 'crosshair',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  touchAction: 'none',
                },
              }}
              backgroundColor="white"
              clearOnResize={false}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" intent="ghost" size="sm" onClick={handleClear}>
              CLEAR
            </Button>
            <SegmentedControl
              items={PEN_ITEMS}
              value={penSize}
              onChange={v => setPenSize(v as PenSize)}
              size="sm"
              aria-label="Pen size"
            />
          </div>

          <Button type="button" intent="primary" loading={saving} onClick={handleSaveDrawing}>
            SAVE DRAWING
          </Button>
        </div>
      )}

      {saved && (
        <ContextBanner tone="success">Brand drawing saved</ContextBanner>
      )}
      {error && (
        <p
          className="type-helper px-3 py-2 rounded-[var(--radius-md)]"
          style={{ color: 'var(--danger-fg)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}
        >
          {error}
        </p>
      )}
    </div>
  )
}
