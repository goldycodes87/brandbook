import { cn } from '@/lib/utils'

type Size = 'sm' | 'md' | 'lg' | 'xl'

interface AvatarProps {
  src?: string | null
  name?: string
  size?: Size
  active?: boolean
  className?: string
}

const sizeClasses: Record<Size, string> = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
}

function initials(name?: string) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : parts[0].slice(0, 2).toUpperCase()
}

export default function Avatar({ src, name, size = 'md', active, className }: AvatarProps) {
  return (
    <div
      className={cn(
        'rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center font-semibold',
        active && 'ring-2 ring-brand-gold/40 ring-offset-1 ring-offset-brand-black',
        sizeClasses[size],
        !src && 'bg-brand-orange text-white',
        className,
      )}
    >
      {src
        ? <img src={src} alt={name ?? ''} className="w-full h-full object-cover" />
        : <span>{initials(name)}</span>
      }
    </div>
  )
}
