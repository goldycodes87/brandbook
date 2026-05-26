import { cn } from '@/lib/utils'

interface TableProps {
  className?: string
  children: React.ReactNode
}

export function Table({ className, children }: TableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-left', className)}>
        {children}
      </table>
    </div>
  )
}

export function THead({ className, children }: TableProps) {
  return (
    <thead
      style={{ borderColor: 'var(--border)' }}
      className={cn('border-b', className)}
    >
      {children}
    </thead>
  )
}

export function TBody({ className, children }: TableProps) {
  return <tbody className={className}>{children}</tbody>
}

export function TFoot({ className, children }: TableProps) {
  return (
    <tfoot
      style={{ borderColor: 'var(--border)' }}
      className={cn('border-t', className)}
    >
      {children}
    </tfoot>
  )
}

interface TRProps {
  onClick?: () => void
  className?: string
  children: React.ReactNode
}

export function TR({ onClick, className, children }: TRProps) {
  return (
    <tr
      onClick={onClick}
      style={{ borderColor: 'var(--border-subtle)' }}
      className={cn(
        'border-b last:border-0 transition-colors duration-100',
        onClick && 'cursor-pointer hover:bg-[var(--surface-2)]',
        className,
      )}
    >
      {children}
    </tr>
  )
}

interface THProps {
  className?: string
  children?: React.ReactNode
  width?: string
}

export function TH({ className, children, width }: THProps) {
  return (
    <th
      style={{ width }}
      className={cn('px-4 py-2.5 type-table-header text-left font-normal', className)}
    >
      {children}
    </th>
  )
}

interface TDProps {
  className?: string
  children?: React.ReactNode
  colSpan?: number
}

export function TD({ className, children, colSpan }: TDProps) {
  return (
    <td
      colSpan={colSpan}
      className={cn('px-4 py-3 type-table-cell text-[var(--text)]', className)}
    >
      {children}
    </td>
  )
}
