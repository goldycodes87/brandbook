/**
 * A registered cattle brand, sitting behind the page like a maker's mark.
 *
 * Only ever a BRAND — never a logo. A logo is a business's wordmark and looks
 * like an advertisement blown up behind your own dashboard; a brand is the
 * mark you burn into an animal, and it is the thing worth having on the wall.
 *
 * ── Why invert + screen ──────────────────────────────────────────────────
 * Brand images arrive as dark strokes on a light ground: BrandDrawingPad
 * exports its canvas with backgroundColor "white", and a photographed brand is
 * usually iron on hide or paper. Dropped straight onto this app's near-black
 * page at any opacity, that reads as a pale rectangle rather than a brand.
 *
 * Inverting turns the light ground black and the strokes white; screen
 * blending then contributes nothing for black, so the ground disappears
 * entirely and only the strokes remain. A brand that arrives already light-on-
 * dark inverts to dark-on-light and simply fades out, which is a quiet failure
 * rather than a grey box over the numbers.
 */
/**
 * Renders a dark-on-light brand image legibly on a dark surface.
 *
 * Invert turns the light ground black and the strokes white; screen blending
 * contributes nothing for black, so the ground drops out and only the mark
 * remains. Shared with the masthead ring so the brand looks like one object in
 * both places rather than a white square in one and a watermark in the other.
 */
export const BRAND_ON_DARK = {
  filter: 'invert(1) grayscale(1) contrast(1.15)',
  mixBlendMode: 'screen',
} as const

export function BrandWatermark({
  src,
  className = '',
}: {
  /** Brand image URL. Empty string and null both mean "no brand yet". */
  src: string | null | undefined
  className?: string
}) {
  // Onboarding leaves an empty string, not null, for a step that was skipped,
  // so test for content rather than for null.
  const url = (src ?? '').trim()
  if (!url) return null

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none absolute inset-0 overflow-hidden ${className}`}
    >
      <div
        className="absolute -top-6 -right-8 sm:-top-10 sm:-right-12 w-56 h-56 sm:w-[24rem] sm:h-[24rem]"
        style={{
          backgroundImage: `url(${JSON.stringify(url)})`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          opacity: 0.3,
          ...BRAND_ON_DARK,
        }}
      />
    </div>
  )
}
