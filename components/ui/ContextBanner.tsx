import { cn } from '@/lib/utils'
import type { Tone } from './tokens'
import { X } from 'lucide-react'

const toneVars = (tone: Tone): React.CSSProperties => {
  if (tone === 'accent')  return { color: 'var(--accent)',    backgroundColor: 'var(--accent-soft)',   borderColor: 'var(--accent-border)' }
  if (tone === 'gold')    return { color: 'var(--gold-fg)',   backgroundColor: 'var(--gold-bg)',       borderColor: 'var(--gold-border)' }
  if (tone === 'purple')  return { color: 'var(--purple-fg)', backgroundColor: 'var(--purple-bg)',     borderColor: 'var(--purple-border)' }
  return {
    color:           `var(--${tone}-fg)`,
    backgroundColor: `var(--${tone}-bg)`,
    borderColor:     `var(--${tone}-border)`,
  }
}

interface ContextBannerProps {
  tone?: Tone
  title?: string
  message: string
  onDismiss?: () => void
  action?: React.ReactNode
  className?: string
}

export function ContextBanner({ tone = 'info', title, message, onDismiss, action, className }: ContextBannerProps) {
  return (
    <div
      style={toneVars(tone)}
      className={cn('flex items-start gap-3 px-4 py-3 rounded-[var(--radius-lg)] border text-sm', className)}
    >
      <div className="flex-1 min-w-0">
        {title && <p className="type-panel-title mb-0.5" style={{ color: 'inherit' }}>{title}</p>}
        <p className="type-helper" style={{ color: 'inherit', opacity: 0.9 }}>{message}</p>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

export default ContextBanner
