'use client'

interface ToggleProps {
  checked: boolean
  onChange: (val: boolean) => void
  disabled?: boolean
  label?: string
  description?: string
}

function ToggleSwitch({ checked, onChange, disabled }: Pick<ToggleProps, 'checked' | 'onChange' | 'disabled'>) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className="relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200"
      style={{
        width: 44,
        height: 24,
        backgroundColor: checked ? 'var(--accent)' : 'var(--surface-3)',
        border: '1px solid',
        borderColor: checked ? 'var(--accent)' : 'var(--border)',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span
        className="inline-block rounded-full bg-white transition-transform duration-200"
        style={{
          width: 18,
          height: 18,
          transform: checked ? 'translateX(22px)' : 'translateX(2px)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      />
    </button>
  )
}

export function Toggle({ checked, onChange, disabled, label, description }: ToggleProps) {
  if (label) {
    return (
      <div className="flex items-center justify-between gap-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="min-w-0">
          <p className="type-field-label" style={{ color: 'var(--text)' }}>{label}</p>
          {description && (
            <p className="type-helper mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>
          )}
        </div>
        <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled} />
      </div>
    )
  }
  return <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled} />
}
