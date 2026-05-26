import { cn } from '@/lib/utils'

interface EmptyStateProps {
  variant?: 'neutral' | 'action'
  title: string
  body?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ variant = 'neutral', title, body, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-12 px-6', className)}>
      {icon && (
        <div
          style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' }}
          className="w-12 h-12 rounded-[var(--radius-xl)] flex items-center justify-center mb-4"
        >
          {icon}
        </div>
      )}
      <h3 className="type-empty-title mb-2">{title}</h3>
      {body && <p className="type-empty-body max-w-xs">{body}</p>}
      {action && variant === 'action' && (
        <div className="mt-5">{action}</div>
      )}
    </div>
  )
}

export default EmptyState
