import Image from 'next/image'
import { BRAND_ON_DARK } from '@/components/brand/BrandWatermark'

/**
 * The ranch plate — brand, logo, brass rule, greeting.
 *
 * The two images are not interchangeable and are not shown the same way:
 *
 *   BRAND — the registered iron mark. Goes INSIDE the ring, because a ring is
 *   what a brand is stamped in. Square-ish, high contrast, survives being
 *   small. Shown only when one exists; an empty ring is worse than no ring.
 *
 *   LOGO — the business's wordmark. Goes OUTSIDE, at its own shape and its own
 *   proportions. Legacy's is 265x152 and carries the ranch name inside the
 *   artwork, so cropping it into a 76px circle destroyed both the name and the
 *   picture — which is exactly what it looked like.
 *
 * Because a logo of that kind already says the ranch name, the text name steps
 * aside when one is present and survives as the image's alt text. Ranches with
 * no logo keep the name set in display type.
 */
export function RanchMasthead({
  ranchName,
  ownerName,
  logoUrl,
  brandUrl,
  timezone,
}: {
  ranchName: string | null
  ownerName: string | null
  logoUrl: string | null
  brandUrl: string | null
  timezone: string
}) {
  // Both names carry trailing spaces in the live row. Trim at the edge so a
  // stray keystroke during onboarding doesn't become a visible gap in display
  // type. Empty string is what a skipped upload leaves, so test for content.
  const ranch = (ranchName ?? '').trim()
  const owner = (ownerName ?? '').trim()
  const logo  = (logoUrl   ?? '').trim()
  const brand = (brandUrl  ?? '').trim()

  const hour = new Date(
    new Date().toLocaleString('en-US', { timeZone: timezone }),
  ).getHours()
  const greeting =
    hour >= 5  && hour < 12 ? 'Good morning'   :
    hour >= 12 && hour < 17 ? 'Good afternoon' :
    'Good evening'

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: timezone,
  })

  return (
    <header className="flex items-center gap-4 sm:gap-5 mb-5 sm:mb-7">
      {brand && (
        <div
          className="relative flex-shrink-0 rounded-full overflow-hidden w-14 h-14 sm:w-[72px] sm:h-[72px]"
          style={{
            border: '2px solid var(--accent)',
            boxShadow: '0 0 0 1px rgba(234,88,12,0.18), 0 0 26px rgba(234,88,12,0.16)',
            background: 'var(--surface-1)',
          }}
        >
          <Image
            src={brand}
            alt={ranch ? `${ranch} brand` : 'Ranch brand'}
            fill
            sizes="72px"
            className="object-contain p-2"
            style={BRAND_ON_DARK}
            priority
          />
        </div>
      )}

      <div className="min-w-0">
        {logo ? (
          <h1 className="m-0">
            <Image
              src={logo}
              alt={ranch || 'Ranch logo'}
              width={265}
              height={152}
              priority
              className="w-auto h-12 sm:h-[68px] object-contain object-left"
            />
          </h1>
        ) : (
          <h1
            className="truncate m-0"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              lineHeight: 1,
              color: 'var(--text)',
              fontSize: 'clamp(1.375rem, 5.5vw, 2.25rem)',
            }}
          >
            {ranch || 'Brand Book'}
          </h1>
        )}

        <div
          className="h-px my-2"
          style={{ background: 'var(--brass-rule)', opacity: 0.8 }}
          aria-hidden="true"
        />

        <p className="type-page-subtitle truncate">
          {owner ? <>{greeting}, {owner}</> : greeting}
          <span className="hidden sm:inline" style={{ color: 'var(--text-muted)' }}>
            {' · '}{today}
          </span>
        </p>
      </div>
    </header>
  )
}
