/**
 * The BrandBook mark — "Bar B" inside the ring of a branding iron.
 *
 * A registered cattle brand is the one western form that is already abstract
 * and already means ownership-and-record, which is the whole product. It
 * stamps in a single colour at any size; the inner hairline is the first thing
 * to drop when it gets small, which is what `size` decides.
 */
export function BrandBookMark({
  size = 56,
  color = 'var(--gold-fg, #D8A657)',
  className,
}: {
  size?: number
  color?: string
  className?: string
}) {
  const small = size < 40
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label="BrandBook"
    >
      <circle cx="60" cy="60" r="55" fill="none" stroke={color} strokeWidth={small ? 5 : 3.5} />
      {!small && (
        <circle cx="60" cy="60" r="47.5" fill="none" stroke={color} strokeWidth="1.2" opacity="0.45" />
      )}
      <rect x="36" y="35" width="48" height={small ? 8 : 6} rx={small ? 4 : 3} fill={color} />
      <text
        x="60"
        y={small ? 92 : 91}
        textAnchor="middle"
        fontFamily="var(--font-display), Oswald, sans-serif"
        fontSize={small ? 50 : 48}
        fontWeight="600"
        fill={color}
      >
        B
      </text>
    </svg>
  )
}

/** Mark plus wordmark, stacked. Splash screens and letterhead. */
export function BrandBookLockup({ size = 56 }: { size?: number }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <BrandBookMark size={size} />
      <span
        style={{
          fontFamily: 'var(--font-display), Oswald, sans-serif',
          fontSize: '1rem',
          fontWeight: 500,
          letterSpacing: '0.34em',
          textTransform: 'uppercase',
          paddingLeft: '0.34em',
          color: 'var(--text)',
        }}
      >
        Brandbook
      </span>
    </div>
  )
}
