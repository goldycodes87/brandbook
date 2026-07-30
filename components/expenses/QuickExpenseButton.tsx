'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { AddLeaseExpenseSheet } from '@/components/leases/AddLeaseExpenseSheet'

export function QuickExpenseButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        aria-label="Log expense"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center shadow-lg xl:hidden"
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '20px',
          zIndex: 50,
          width: '3.5rem',
          height: '3.5rem',
          borderRadius: '9999px',
          background: 'var(--accent)',
          color: 'white',
        }}
      >
        <Plus size={24} />
      </button>

      <AddLeaseExpenseSheet
        isOpen={open}
        onClose={() => setOpen(false)}
        onSuccess={() => setOpen(false)}
        defaultScope="whole_herd"
      />
    </>
  )
}
