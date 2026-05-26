import { cn } from '@/lib/utils'

interface PanelProps {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
  className?: string
  children: React.ReactNode
  noPadding?: boolean
}

export function Panel({ title, subtitle, actions, className, children, noPadding }: PanelProps) {
  return (
    <div
      style={{ backgroundColor: 'var(--surface-1)', borderColor: 'var(--border)' }}
      className={cn('rounded-[var(--radius-xl)] border', className)}
    >
      {(title || actions) && (
        <div
          style={{ borderColor: 'var(--border)' }}
          className="flex items-center justify-between px-4 py-3 border-b"
        >
          <div>
            {title && <h3 className="type-panel-title">{title}</h3>}
            {subtitle && <p className="type-helper mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(!noPadding && 'p-4')}>{children}</div>
    </div>
  )
}

interface PanelSectionProps {
  title?: string
  className?: string
  children: React.ReactNode
}

export function PanelSection({ title, className, children }: PanelSectionProps) {
  return (
    <div className={cn('', className)}>
      {title && (
        <div
          style={{ borderColor: 'var(--border)' }}
          className="px-4 py-2 border-b"
        >
          <span className="type-section-label">{title}</span>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  )
}

export default Panel
