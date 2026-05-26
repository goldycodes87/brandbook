'use client'

import { forwardRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  icon?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, className, ...props }, ref) => {
    const [focused, setFocused] = useState(false)
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label className="text-sm font-medium text-brand-white/70">{label}</label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray">{icon}</span>
          )}
          <input
            ref={ref}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className={cn(
              'w-full h-11 rounded-lg px-3 bg-brand-surface text-brand-white placeholder:text-brand-gray/60',
              'border transition-colors duration-200 outline-none',
              error   ? 'border-red-500' :
              focused ? 'border-brand-orange' :
                        'border-brand-gray/40',
              icon && 'pl-10',
              className,
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {hint && !error && <p className="text-xs text-brand-gray">{hint}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
