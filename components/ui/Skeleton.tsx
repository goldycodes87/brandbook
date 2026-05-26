import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  style?: React.CSSProperties
  width?: string | number
  height?: string | number
  rounded?: boolean
  circle?: boolean
}

export function Skeleton({ className, width, height, rounded, circle }: SkeletonProps) {
  return (
    <div
      style={{
        width,
        height,
        backgroundColor: 'var(--surface-3)',
      }}
      className={cn(
        'animate-pulse',
        circle ? 'rounded-full' :
        rounded ? 'rounded-[var(--radius-xl)]' :
        'rounded-[var(--radius-md)]',
        className,
      )}
    />
  )
}

export function SkeletonText({ lines = 1, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-4" style={{ width: i === lines - 1 && lines > 1 ? '60%' : '100%' } as React.CSSProperties} />
      ))}
    </div>
  )
}

export default Skeleton
