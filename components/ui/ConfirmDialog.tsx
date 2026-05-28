'use client'

import { Button } from '@/components/ui/Button'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  intent?: 'danger' | 'warning'
  loading?: boolean
  children?: React.ReactNode
}

export function ConfirmDialog({
  isOpen, onClose, onConfirm, title, message,
  confirmLabel = 'Delete', loading, children,
}: ConfirmDialogProps) {
  if (!isOpen) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-sm rounded-xl flex flex-col gap-4"
        style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', padding: '24px' }}
      >
        <p className="type-panel-title">{title}</p>
        <p className="type-helper" style={{ color: 'var(--text-muted)' }}>{message}</p>
        {children}
        <div className="flex gap-3 justify-end pt-1">
          <Button type="button" intent="ghost" onClick={onClose} disabled={loading}>CANCEL</Button>
          <Button type="button" intent="danger" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}
