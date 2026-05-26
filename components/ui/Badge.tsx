import { cn } from '@/lib/utils'

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'
type Size = 'sm' | 'md'

interface BadgeProps {
  variant?: Variant
  size?: Size
  className?: string
  children: React.ReactNode
}

const variantClasses: Record<Variant, string> = {
  success: 'bg-green-900/60 text-green-400',
  warning: 'bg-amber-900/60 text-amber-400',
  danger:  'bg-red-900/60 text-red-400',
  info:    'bg-blue-900/60 text-blue-400',
  neutral: 'bg-brand-surface-2 text-brand-white/70',
}

const sizeClasses: Record<Size, string> = {
  sm: 'text-xs px-2 py-0.5 rounded',
  md: 'text-sm px-2.5 py-1 rounded-md',
}

export default function Badge({ variant = 'neutral', size = 'sm', className, children }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center font-medium', variantClasses[variant], sizeClasses[size], className)}>
      {children}
    </span>
  )
}
