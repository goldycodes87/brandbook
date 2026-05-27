'use client'

import { useState, useCallback, useRef } from 'react'
import { ScanLine, ChevronDown } from 'lucide-react'
import { SearchField } from '@/components/ui/Field'
import { ContextBanner } from '@/components/ui/ContextBanner'
import { BarcodeScanner } from '@/components/health/BarcodeScanner'

export interface DrugRecord {
  id?: string
  brand_name: string
  generic_name?: string | null
  ndc_code?: string | null
  route?: string | null
  drug_class?: string | null
  withdrawal_days_meat?: number | null
  withdrawal_days_milk?: number | null
  dosage_info?: string | null
}

interface DrugSelectorProps {
  value: DrugRecord | null
  onChange: (drug: DrugRecord | null) => void
}

export function DrugSelector({ value, onChange }: DrugSelectorProps) {
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState<DrugRecord[]>([])
  const [open, setOpen]           = useState(false)
  const [scanning, setScanning]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/drugs?search=${encodeURIComponent(q)}&limit=10`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
      setOpen(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleQueryChange = (q: string) => {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(q), 300)
  }

  const handleBarcode = useCallback(async (code: string) => {
    setScanning(false)
    setLoading(true)
    try {
      const res = await fetch(`/api/drugs/barcode?code=${encodeURIComponent(code)}`)
      if (res.ok) {
        const drug = await res.json()
        onChange(drug)
        setQuery(drug.brand_name)
        setOpen(false)
      } else {
        // Not found — pre-fill search with scanned code
        setQuery(code)
        search(code)
      }
    } finally {
      setLoading(false)
    }
  }, [onChange, search])

  const select = (drug: DrugRecord) => {
    onChange(drug)
    setQuery(drug.brand_name)
    setOpen(false)
    setResults([])
  }

  const clear = () => {
    onChange(null)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  const withdrawalDays = value?.withdrawal_days_meat ?? value?.withdrawal_days_milk ?? null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <SearchField
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Search drug name or NDC…"
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 type-helper" style={{ color: 'var(--text-muted)' }}>
              …
            </span>
          )}
          {open && results.length > 0 && (
            <div
              className="absolute z-20 left-0 right-0 top-full mt-1 rounded-[var(--radius-md)] overflow-hidden shadow-lg"
              style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', maxHeight: 280, overflowY: 'auto' }}
            >
              {results.map((drug, i) => (
                <button
                  key={drug.id ?? i}
                  type="button"
                  onClick={() => select(drug)}
                  className="w-full text-left px-3 py-2.5 transition-colors duration-100 flex items-start gap-2"
                  style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-3)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                >
                  <div className="flex-1 min-w-0">
                    <p className="type-data-sm truncate">{drug.brand_name}</p>
                    {drug.generic_name && (
                      <p className="type-helper truncate" style={{ color: 'var(--text-muted)' }}>{drug.generic_name}</p>
                    )}
                  </div>
                  {drug.route && (
                    <span className="type-helper shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>{drug.route}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setScanning(true)}
          title="Scan barcode"
          className="w-10 h-10 flex items-center justify-center rounded-[var(--radius-md)] shrink-0 transition-colors duration-150"
          style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--accent)' }}
        >
          <ScanLine size={18} />
        </button>

        {value && (
          <button
            type="button"
            onClick={clear}
            className="w-10 h-10 flex items-center justify-center rounded-[var(--radius-md)] shrink-0 transition-colors duration-150 type-helper"
            style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            <ChevronDown size={16} />
          </button>
        )}
      </div>

      {/* Withdrawal banner */}
      {value && withdrawalDays != null && withdrawalDays > 0 && (
        <ContextBanner tone="warning" emphasis eyebrow="WITHDRAWAL PERIOD">
          {value.withdrawal_days_meat != null && `Meat: ${value.withdrawal_days_meat} days`}
          {value.withdrawal_days_meat != null && value.withdrawal_days_milk != null && ' · '}
          {value.withdrawal_days_milk != null && `Milk: ${value.withdrawal_days_milk} days`}
        </ContextBanner>
      )}

      {scanning && (
        <BarcodeScanner
          onResult={handleBarcode}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
  )
}
