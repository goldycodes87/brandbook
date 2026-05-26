import { cn } from '@/lib/utils'

type Variant = 'default' | 'elevated' | 'outlined'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant
  padding?: string
}

const variantClasses: Record<Variant, string> = {
  default:  'bg-brand-surface border border-brand-gray/30',
  elevated: 'bg-brand-surface-2 border border-brand-gray/30 shadow-inner',
  outlined: 'bg-transparent border border-brand-gray/50',
}

export default function Card({ variant = 'default', padding = 'p-4', className, onClick, children, ...props }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl transition-all duration-200',
        variantClasses[variant],
        padding,
        onClick && 'cursor-pointer hover:border-brand-gray/60',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
