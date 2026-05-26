import Card from './Card'
import { type LucideIcon } from 'lucide-react'

interface ComingSoonProps {
  title: string
  description?: string
  icon: LucideIcon
}

export default function ComingSoon({ title, description, icon: Icon }: ComingSoonProps) {
  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display text-brand-white">{title}</h1>
      </div>
      <Card className="p-12 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-orange/10 flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-brand-orange/60" />
        </div>
        <h2 className="text-lg font-semibold text-brand-white/70 mb-2">Coming soon</h2>
        <p className="text-sm text-brand-white/30 max-w-xs">
          {description ?? `${title} tracking is in development and will be available soon.`}
        </p>
      </Card>
    </div>
  )
}
