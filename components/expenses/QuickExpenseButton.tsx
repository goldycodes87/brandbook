'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, DollarSign, Heart, Zap } from 'lucide-react'
import { QuickExpenseSheet } from '@/components/expenses/QuickExpenseSheet'
import { QuickHealthSheet } from '@/components/expenses/QuickHealthSheet'

const ITEMS = [
  { label: 'CHUTE MODE',       icon: Zap,         delay: 100 },
  { label: 'LOG HEALTH EVENT', icon: Heart,        delay: 50  },
  { label: 'ADD EXPENSE',      icon: DollarSign,   delay: 0   },
] as const

export function QuickExpenseButton() {
  const router = useRouter()
  const [open,        setOpen]        = useState(false)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [healthOpen,  setHealthOpen]  = useState(false)

  const handleAction = (label: typeof ITEMS[number]['label']) => {
    setOpen(false)
    if (label === 'ADD EXPENSE')      setExpenseOpen(true)
    if (label === 'LOG HEALTH EVENT') setHealthOpen(true)
    if (label === 'CHUTE MODE')       router.push('/chute')
  }

  return (
    <>
      {/* Backdrop — closes dial on outside tap */}
      {open && (
        <div
          className="fixed inset-0 z-40 xl:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Speed dial container */}
      <div
        className="xl:hidden"
        style={{
          position: 'fixed',
          bottom: 80,
          right: 20,
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
        }}
      >
        {/* Pill items — fan up above FAB */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
          {ITEMS.map(item => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleAction(item.label)}
              style={{
                height: 48,
                paddingLeft: 16,
                paddingRight: 16,
                borderRadius: 24,
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                transform: open ? 'translateY(0)' : 'translateY(20px)',
                opacity: open ? 1 : 0,
                pointerEvents: open ? 'auto' : 'none',
                transition: `transform 200ms ease ${item.delay}ms, opacity 200ms ease ${item.delay}ms`,
                whiteSpace: 'nowrap',
                willChange: 'transform, opacity',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: 'var(--text)',
                }}
              >
                {item.label}
              </span>
              <item.icon size={15} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            </button>
          ))}
        </div>

        {/* FAB — rotates to × when open */}
        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Quick actions'}
          onClick={() => setOpen(o => !o)}
          className="flex items-center justify-center shadow-lg"
          style={{
            width: '3.5rem',
            height: '3.5rem',
            borderRadius: '9999px',
            background: 'var(--accent)',
            color: 'white',
            transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
            transition: 'transform 220ms ease',
          }}
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Sheets */}
      <QuickExpenseSheet
        isOpen={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        onSuccess={() => { setExpenseOpen(false); router.refresh() }}
      />
      <QuickHealthSheet
        isOpen={healthOpen}
        onClose={() => setHealthOpen(false)}
        onSuccess={() => { setHealthOpen(false); router.refresh() }}
      />
    </>
  )
}
