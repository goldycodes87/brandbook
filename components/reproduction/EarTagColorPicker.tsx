'use client'

const COLORS = [
  { value: 'yellow',  hex: '#EAB308' },
  { value: 'orange',  hex: '#F97316' },
  { value: 'red',     hex: '#EF4444' },
  { value: 'green',   hex: '#22C55E' },
  { value: 'blue',    hex: '#3B82F6' },
  { value: 'white',   hex: '#F1F5F9' },
  { value: 'pink',    hex: '#EC4899' },
  { value: 'purple',  hex: '#A855F7' },
  { value: 'black',   hex: '#1E293B' },
]

interface EarTagColorPickerProps {
  value: string | null
  onChange: (color: string | null) => void
}

export function EarTagColorPicker({ value, onChange }: EarTagColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLORS.map(c => (
        <button
          key={c.value}
          type="button"
          onClick={() => onChange(value === c.value ? null : c.value)}
          title={c.value}
          className="w-8 h-8 rounded-full transition-transform"
          style={{
            backgroundColor: c.hex,
            border: value === c.value ? '3px solid var(--accent)' : '2px solid var(--border)',
            transform: value === c.value ? 'scale(1.2)' : 'scale(1)',
            outline: value === c.value ? '2px solid var(--accent-bg)' : 'none',
            outlineOffset: '1px',
          }}
          aria-pressed={value === c.value}
          aria-label={c.value}
        />
      ))}
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="type-helper px-2 rounded-full"
          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
        >
          ✕
        </button>
      )}
    </div>
  )
}
