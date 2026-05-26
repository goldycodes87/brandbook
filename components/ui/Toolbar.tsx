import { cn } from '@/lib/utils'

interface ToolbarProps {
  leading?: React.ReactNode
  trailing?: React.ReactNode
  className?: string
  children?: React.ReactNode
}

export function Toolbar({ leading, trailing, className, children }: ToolbarProps) {
  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      {leading && <div className="flex items-center gap-2 flex-wrap">{leading}</div>}
      {children && <div className="flex items-center gap-2">{children}</div>}
      {trailing && <div className="flex items-center gap-2 ml-auto">{trailing}</div>}
    </div>
  )
}

export default Toolbar
