'use client'

import { forwardRef } from 'react'
import Link, { type LinkProps } from 'next/link'
import { cn } from '@/lib/utils'

export type Intent = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
export type BtnSize = 'sm' | 'md' | 'lg'

const intentStyles: Record<Intent, string> = {
  primary:   'text-white border border-transparent',
  secondary: 'border text-[var(--text)] hover:bg-[var(--surface-3)]',
  ghost:     'border border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
  danger:    'border border-transparent text-white',
  outline:   'border text-[var(--accent)] hover:bg-[var(--accent-soft)]',
}

const intentVars = (intent: Intent): React.CSSProperties => {
  if (intent === 'primary')   return { backgroundColor: 'var(--accent)' }
  if (intent === 'secondary') return { backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }
  if (intent === 'danger')    return { backgroundColor: 'var(--danger-fg)' }
  if (intent === 'outline')   return { borderColor: 'var(--accent-border)' }
  return {}
}

const sizeStyles: Record<BtnSize, string> = {
  sm: 'h-8  px-3 gap-1.5 text-xs  rounded-[var(--radius-md)]',
  md: 'h-9  px-4 gap-2   text-sm  rounded-[var(--radius-lg)]',
  lg: 'h-11 px-5 gap-2.5 text-sm  rounded-[var(--radius-xl)]',
}

const Spinner = () => (
  <svg className="animate-spin w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
)

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  intent?: Intent
  size?: BtnSize
  loading?: boolean
  block?: boolean
  leadingIcon?: React.ReactNode
  trailingIcon?: React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ intent = 'secondary', size = 'md', loading, block, leadingIcon, trailingIcon, className, children, disabled, style, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      style={{ ...intentVars(intent), ...style }}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-150 select-none',
        'type-button',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        intentStyles[intent],
        sizeStyles[size],
        block && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? <Spinner /> : leadingIcon ? <span className="flex-shrink-0">{leadingIcon}</span> : null}
      {children}
      {trailingIcon && !loading ? <span className="flex-shrink-0">{trailingIcon}</span> : null}
    </button>
  )
)
Button.displayName = 'Button'

type ButtonLinkProps = Omit<LinkProps, 'className'> & {
  intent?: Intent
  size?: BtnSize
  block?: boolean
  leadingIcon?: React.ReactNode
  trailingIcon?: React.ReactNode
  className?: string
  children?: React.ReactNode
  style?: React.CSSProperties
}

export const ButtonLink = ({ intent = 'secondary', size = 'md', block, leadingIcon, trailingIcon, className, children, style, ...props }: ButtonLinkProps) => (
  <Link
    style={{ ...intentVars(intent), ...style }}
    className={cn(
      'inline-flex items-center justify-center font-medium transition-all duration-150 select-none',
      'type-button',
      intentStyles[intent],
      sizeStyles[size],
      block && 'w-full',
      className,
    )}
    {...props}
  >
    {leadingIcon ? <span className="flex-shrink-0">{leadingIcon}</span> : null}
    {children}
    {trailingIcon ? <span className="flex-shrink-0">{trailingIcon}</span> : null}
  </Link>
)

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  intent?: Intent
  size?: BtnSize
  label: string
  loading?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ intent = 'ghost', size = 'md', label, loading, className, children, disabled, style, ...props }, ref) => (
    <button
      ref={ref}
      aria-label={label}
      disabled={disabled || loading}
      style={{ ...intentVars(intent), ...style }}
      className={cn(
        'inline-flex items-center justify-center transition-all duration-150 flex-shrink-0',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        intentStyles[intent],
        size === 'sm' ? 'w-8  h-8  rounded-[var(--radius-md)]' :
        size === 'lg' ? 'w-11 h-11 rounded-[var(--radius-xl)]' :
                        'w-9  h-9  rounded-[var(--radius-lg)]',
        className,
      )}
      {...props}
    >
      {loading ? <Spinner /> : children}
    </button>
  )
)
IconButton.displayName = 'IconButton'

export default Button
