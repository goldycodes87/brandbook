import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  icon?: React.ReactNode
  valueColor?: string
  trend?: string
  trendUp?: boolean
  className?: string
}

export function StatCard({ title, value, icon, valueColor, trend, trendUp, className }: StatCardProps) {
  return (
    <div
      style={{ backgroundColor: 'var(--surface-1)', borderColor: 'var(--border)' }}
      className={cn('rounded-[var(--radius-xl)] border p-4', className)}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="type-metric-label">{title}</span>
        {icon && (
          <div
            style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          >
            {icon}
          </div>
        )}
      </div>
      <p
        className="type-metric-value"
        style={{ color: valueColor ?? 'var(--text)' }}
      >
        {value}
      </p>
      {trend && (
        <p
          className="type-helper mt-1.5"
          style={{ color: trendUp ? 'var(--success-fg)' : 'var(--danger-fg)' }}
        >
          {trend}
        </p>
      )}
    </div>
  )
}

export default StatCard
