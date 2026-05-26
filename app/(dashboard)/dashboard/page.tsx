import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { Beef, Stethoscope, MapPin, TrendingUp, Plus, ArrowRight } from 'lucide-react'

export default function DashboardPage() {
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-4xl mx-auto">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold font-display text-brand-white">
          {greeting} 👋
        </h1>
        <p className="text-brand-white/40 text-sm mt-1">
          {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Card className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-brand-orange/15 flex items-center justify-center">
              <Beef className="w-4 h-4 text-brand-orange" />
            </div>
            <Badge variant="success" size="sm">+3</Badge>
          </div>
          <p className="text-2xl font-bold text-brand-white">—</p>
          <p className="text-xs text-brand-white/40 mt-0.5">Total Animals</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-red-400" />
            </div>
            <Badge variant="danger" size="sm">0</Badge>
          </div>
          <p className="text-2xl font-bold text-brand-white">—</p>
          <p className="text-xs text-brand-white/40 mt-0.5">Health Alerts</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-green-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-brand-white">—</p>
          <p className="text-xs text-brand-white/40 mt-0.5">Pastures</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-brand-gold/15 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-brand-gold" />
            </div>
          </div>
          <p className="text-2xl font-bold text-brand-white">—</p>
          <p className="text-xs text-brand-white/40 mt-0.5">Sales YTD</p>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-brand-white/50 uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { label: 'Add animal', href: '/animals' },
            { label: 'Record health event', href: '/health' },
            { label: 'Move to pasture', href: '/grazing' },
            { label: 'Log sale', href: '/sales' },
          ].map(action => (
            <a
              key={action.href}
              href={action.href}
              className="flex items-center justify-between px-4 py-3 rounded-xl bg-brand-surface border border-brand-gray/20 hover:border-brand-orange/30 hover:bg-brand-surface-2 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-brand-orange/10 flex items-center justify-center">
                  <Plus className="w-3.5 h-3.5 text-brand-orange" />
                </div>
                <span className="text-sm font-medium text-brand-white/80">{action.label}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-brand-white/20 group-hover:text-brand-orange transition-colors" />
            </a>
          ))}
        </div>
      </div>

      {/* Activity feed */}
      <div>
        <h2 className="text-sm font-semibold text-brand-white/50 uppercase tracking-wider mb-3">Recent Activity</h2>
        <Card className="p-6 text-center">
          <p className="text-brand-white/30 text-sm">No activity yet — start by adding your first animal.</p>
        </Card>
      </div>
    </div>
  )
}
