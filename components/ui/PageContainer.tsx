import { cn } from '@/lib/utils'

type Variant = 'narrow' | 'wide' | 'full'

const maxWidths: Record<Variant, string> = {
  narrow: 'max-w-3xl',
  wide:   'max-w-5xl',
  full:   'max-w-none',
}

interface PageContainerProps {
  variant?: Variant
  className?: string
  children: React.ReactNode
}

export function PageContainer({ variant = 'wide', className, children }: PageContainerProps) {
  return (
    <div className={cn('w-full mx-auto px-4 py-6 md:px-6 md:py-8', maxWidths[variant], className)}>
      {children}
    </div>
  )
}

export default PageContainer
