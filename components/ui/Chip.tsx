import { cn } from '@/lib/utils'
import type { Tone, ChipPreset } from './tokens'

const toneVars = (tone: Tone): React.CSSProperties => {
  if (tone === 'accent')  return { color: 'var(--accent)',     backgroundColor: 'var(--accent-soft)',   borderColor: 'var(--accent-border)' }
  if (tone === 'gold')    return { color: 'var(--gold-fg)',    backgroundColor: 'var(--gold-bg)',       borderColor: 'var(--gold-border)' }
  if (tone === 'purple')  return { color: 'var(--purple-fg)',  backgroundColor: 'var(--purple-bg)',     borderColor: 'var(--purple-border)' }
  return {
    color:           `var(--${tone}-fg)`,
    backgroundColor: `var(--${tone}-bg)`,
    borderColor:     `var(--${tone}-border)`,
  }
}

interface ChipProps {
  label: string
  tone?: Tone
  icon?: string
  size?: 'sm' | 'md'
  className?: string
}

export function Chip({ label, tone = 'neutral', icon, size = 'sm', className }: ChipProps) {
  return (
    <span
      style={toneVars(tone)}
      className={cn(
        'inline-flex items-center gap-1 border rounded-[var(--radius-sm)] type-chip',
        size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-1',
        className,
      )}
    >
      {icon && <span className="text-[0.6rem] leading-none">{icon}</span>}
      {label}
    </span>
  )
}

interface StatusChipProps {
  preset: ChipPreset
  size?: 'sm' | 'md'
  className?: string
}

export function StatusChip({ preset, size, className }: StatusChipProps) {
  return <Chip label={preset.label} tone={preset.tone} icon={preset.icon} size={size} className={className} />
}

export default Chip
