import { cn } from '@/lib/utils'

interface ActionFooterProps {
  leading?: React.ReactNode
  trailing?: React.ReactNode
  className?: string
  children?: React.ReactNode
  sticky?: boolean
}

export function ActionFooter({ leading, trailing, className, children, sticky = true }: ActionFooterProps) {
  return (
    <div
      style={{ backgroundColor: 'var(--surface-1)', borderColor: 'var(--border)' }}
      className={cn(
        'flex items-center justify-between gap-3 px-4 py-3 border-t',
        sticky && 'sticky bottom-0',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {leading}
      </div>
      <div className="flex items-center gap-2">
        {children}
        {trailing}
      </div>
    </div>
  )
}

export default ActionFooter
