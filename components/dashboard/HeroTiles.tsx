import Link from 'next/link'
import { Mic } from 'lucide-react'

/**
 * The two thumb targets: ask the ranch something, or go work cattle.
 *
 * Paired side by side because standing at the chute it is one decision, not
 * two — and because these are the only things on the dashboard you press
 * with a glove on. Everything else is read.
 */
export function HeroTiles() {
  return (
    <div className="grid grid-cols-2 gap-3 mb-5 sm:mb-6">
      <Link
        href="/ai"
        className="rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between sm:justify-start gap-3 sm:gap-4 min-h-[104px] transition-opacity hover:opacity-90 active:scale-[0.99]"
        style={{
          background: 'linear-gradient(165deg, var(--surface-3) 0%, var(--surface-1) 100%)',
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--lift)',
        }}
      >
        <span
          className="grid place-content-center rounded-full flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11"
          style={{
            background: 'var(--accent-soft)',
            border: '1px solid var(--accent-border)',
            color: 'var(--accent)',
          }}
        >
          <Mic size={19} />
        </span>
        <span className="min-w-0">
          <span
            className="block"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.2rem',
              fontWeight: 700,
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              lineHeight: 1.05,
              color: 'var(--text)',
            }}
          >
            Ask
          </span>
          <span className="block type-helper mt-0.5">Voice or text</span>
        </span>
      </Link>

      <Link
        href="/chute"
        className="rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between sm:justify-start gap-3 sm:gap-4 min-h-[104px] transition-opacity hover:opacity-90 active:scale-[0.99]"
        style={{
          background: 'linear-gradient(155deg, var(--ember) 0%, var(--accent) 45%, #b8410a 100%)',
          border: '1px solid rgba(255,180,120,0.28)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), 0 6px 26px rgba(234,88,12,0.28)',
          color: '#fff',
        }}
      >
        <span className="text-[22px] sm:text-[26px] leading-none flex-shrink-0" aria-hidden>🐄</span>
        <span className="min-w-0">
          <span
            className="block"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.2rem',
              fontWeight: 700,
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              lineHeight: 1.05,
            }}
          >
            Chute Mode
          </span>
          <span
            className="block mt-0.5 text-[0.72rem] sm:text-xs"
            style={{ opacity: 0.78 }}
          >
            Work a group, one at a time
          </span>
        </span>
      </Link>
    </div>
  )
}
