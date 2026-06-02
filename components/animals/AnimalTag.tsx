import { EarTagDot } from '@/components/ui/EarTagDot'

interface AnimalTagProps {
  tagNumber: string
  earTagColor?: string | null
  name?: string | null
  size?: 'sm' | 'md' | 'lg'
}

export function AnimalTag({ tagNumber, earTagColor, name, size = 'md' }: AnimalTagProps) {
  return (
    <div className="flex items-center gap-1.5">
      <EarTagDot color={earTagColor} size={size} />
      <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{tagNumber}</span>
      {name && (
        <span className="type-helper" style={{ color: 'var(--text-muted)' }}>— {name}</span>
      )}
    </div>
  )
}
