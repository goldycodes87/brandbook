'use client'

import { forwardRef, useId, useState } from 'react'
import { cn } from '@/lib/utils'
import { Search } from 'lucide-react'

interface FieldProps {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}

export function Field({ label, hint, error, required, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label className="type-field-label flex items-center gap-1">
          {label}
          {required && <span style={{ color: 'var(--danger-fg)' }}>*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="type-helper" style={{ color: 'var(--danger-fg)' }}>{error}</p>
      ) : hint ? (
        <p className="type-helper">{hint}</p>
      ) : null}
    </div>
  )
}

const inputBase = [
  'w-full h-10 px-3 rounded-[var(--radius-lg)] border text-[var(--text)]',
  'type-table-cell transition-colors duration-150',
  'placeholder:text-[var(--text-disabled)]',
  'disabled:opacity-50 disabled:cursor-not-allowed',
].join(' ')

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, className, ...props }, ref) => {
    const [focused, setFocused] = useState(false)
    const content = (
      <input
        ref={ref}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          backgroundColor: focused ? 'var(--bg-input-focus)' : 'var(--bg-input)',
          borderColor: error ? 'var(--danger-fg)' : focused ? 'var(--border-strong)' : 'var(--border)',
          boxShadow: focused ? '0 0 0 3px var(--accent-soft)' : undefined,
        }}
        className={cn(inputBase, className)}
        {...props}
      />
    )
    if (!label && !hint && !error) return content
    return <Field label={label} hint={hint} error={error} required={props.required}>{content}</Field>
  }
)
Input.displayName = 'Input'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, className, ...props }, ref) => {
    const [focused, setFocused] = useState(false)
    const content = (
      <textarea
        ref={ref}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          backgroundColor: focused ? 'var(--bg-input-focus)' : 'var(--bg-input)',
          borderColor: error ? 'var(--danger-fg)' : focused ? 'var(--border-strong)' : 'var(--border)',
          boxShadow: focused ? '0 0 0 3px var(--accent-soft)' : undefined,
        }}
        className={cn(
          'w-full px-3 py-2.5 rounded-[var(--radius-lg)] border text-[var(--text)]',
          'type-table-cell transition-colors duration-150 resize-y min-h-[80px]',
          'placeholder:text-[var(--text-disabled)] disabled:opacity-50',
          className,
        )}
        {...props}
      />
    )
    if (!label && !hint && !error) return content
    return <Field label={label} hint={hint} error={error} required={props.required}>{content}</Field>
  }
)
Textarea.displayName = 'Textarea'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, className, children, ...props }, ref) => {
    const [focused, setFocused] = useState(false)
    const content = (
      <select
        ref={ref}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          backgroundColor: focused ? 'var(--bg-input-focus)' : 'var(--bg-input)',
          borderColor: error ? 'var(--danger-fg)' : focused ? 'var(--border-strong)' : 'var(--border)',
          boxShadow: focused ? '0 0 0 3px var(--accent-soft)' : undefined,
          color: 'var(--text)',
        }}
        className={cn(inputBase, 'appearance-none cursor-pointer pr-8', className)}
        {...props}
      >
        {children}
      </select>
    )
    if (!label && !hint && !error) return content
    return <Field label={label} hint={hint} error={error} required={props.required}>{content}</Field>
  }
)
Select.displayName = 'Select'

interface SearchFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onClear?: () => void
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(
  ({ className, onClear, ...props }, ref) => {
    const [focused, setFocused] = useState(false)
    return (
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
          style={{ color: 'var(--text-muted)' }}
        />
        <input
          ref={ref}
          type="search"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            backgroundColor: focused ? 'var(--bg-input-focus)' : 'var(--bg-input)',
            borderColor: focused ? 'var(--border-strong)' : 'var(--border)',
            boxShadow: focused ? '0 0 0 3px var(--accent-soft)' : undefined,
          }}
          className={cn(inputBase, 'pl-9', className)}
          {...props}
        />
      </div>
    )
  }
)
SearchField.displayName = 'SearchField'
