import { EAR_TAG_COLOR_HEX } from '@/components/ui/tokens'

interface EarTagDotProps {
  color: string | null | undefined
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: 'w-2.5 h-2.5',
  md: 'w-3.5 h-3.5',
  lg: 'w-5 h-5',
}

export function EarTagDot({ color, size = 'md' }: EarTagDotProps) {
  if (!color) return null
  const hex = EAR_TAG_COLOR_HEX[color.toLowerCase()] ?? '#888'
  return (
    <span
      className={`inline-block ${SIZES[size]} rounded-full flex-shrink-0`}
      style={{ backgroundColor: hex, border: '1px solid rgba(0,0,0,0.15)' }}
      title={`${color} tag`}
    />
  )
}
