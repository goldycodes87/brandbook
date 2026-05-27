'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { X } from 'lucide-react'

interface BarcodeScannerProps {
  onResult: (code: string) => void
  onClose: () => void
}

export function BarcodeScanner({ onResult, onClose }: BarcodeScannerProps) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<{ stop(): void } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let done = false

    const constraints: MediaStreamConstraints = {
      video: { facingMode: { ideal: 'environment' } },
    }

    reader.decodeFromConstraints(constraints, videoRef.current!, (result, err) => {
      if (done) return
      if (result) {
        done = true
        controlsRef.current?.stop()
        onResult(result.getText())
      }
    }).then(controls => {
      controlsRef.current = controls
    }).catch(() => {
      if (!done) setError('Could not access camera — check permissions')
    })

    return () => {
      done = true
      controlsRef.current?.stop()
    }
  }, [onResult])

  const handleClose = () => {
    controlsRef.current?.stop()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: '#000' }}
    >
      <video
        ref={videoRef}
        className="flex-1 w-full object-cover"
        muted
        playsInline
      />

      {/* Scanning overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-64 h-40">
          {[
            'top-0 left-0 border-t-2 border-l-2 rounded-tl-md',
            'top-0 right-0 border-t-2 border-r-2 rounded-tr-md',
            'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-md',
            'bottom-0 right-0 border-b-2 border-r-2 rounded-br-md',
          ].map((cls, i) => (
            <div
              key={i}
              className={`absolute w-6 h-6 ${cls}`}
              style={{ borderColor: 'var(--accent)' }}
            />
          ))}
          <div
            className="absolute left-2 right-2 h-0.5 animate-scan-line"
            style={{ backgroundColor: 'var(--accent)' }}
          />
        </div>
      </div>

      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      >
        <span className="type-field-label text-white">Scan barcode or NDC</span>
        <button
          onClick={handleClose}
          className="w-8 h-8 flex items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
        >
          <X size={16} color="#fff" />
        </button>
      </div>

      {error && (
        <div className="absolute bottom-6 left-4 right-4 text-center">
          <p className="type-helper text-white bg-red-600/80 rounded-lg px-4 py-2">{error}</p>
        </div>
      )}
    </div>
  )
}
