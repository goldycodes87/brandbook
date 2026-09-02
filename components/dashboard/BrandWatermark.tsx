/**
 * The ranch brand, debossed into the page.
 *
 * Deliberately faint — a watermark that competes with the numbers on top of it
 * is a mistake you only notice on a bright screen in a truck. The dark drop
 * shadow underneath makes it read as pressed into the page rather than
 * printed on it.
 *
 * Falls back to the logo when no brand has been uploaded, and renders nothing
 * when neither exists. Decorative, so it is hidden from assistive tech.
 */
export function BrandWatermark({
  brandUrl,
  logoUrl,
}: {
  brandUrl: string | null
  logoUrl: string | null
}) {
  // Empty strings, not nulls, are what onboarding leaves behind for a field
  // that was skipped — so test for content, not for null.
  const src = (brandUrl ?? '').trim() || (logoUrl ?? '').trim()
  if (!src) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none absolute -top-8 -right-10 sm:-top-16 sm:-right-16 w-64 h-64 sm:w-[26rem] sm:h-[26rem]"
      style={{
        backgroundImage: `url(${JSON.stringify(src)})`,
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        opacity: 0.05,
        filter: 'grayscale(1) contrast(1.15) drop-shadow(0 2px 0 rgba(0,0,0,0.6))',
      }}
    />
  )
}
