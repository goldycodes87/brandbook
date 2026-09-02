import Image from 'next/image'
import { BrandBookMark } from '@/components/brand/BrandBookMark'

/**
 * The ranch plate — mark, name, brass rule, greeting.
 *
 * This is the first thing on the dashboard because the dashboard is somewhere
 * you land every morning, and you should know whose outfit this is inside half
 * a second. The BrandBook mark only stands in when a ranch has not uploaded a
 * logo yet: on a ranch that has one, the product's identity has no business
 * being the largest thing on the owner's own home screen.
 *
 * Values are passed in rather than fetched here so the page reads
 * ranch_settings once and shares the row with <BrandWatermark>.
 */
export function RanchMasthead({
  ranchName,
  ownerName,
  logoUrl,
  timezone,
}: {
  ranchName: string | null
  ownerName: string | null
  logoUrl: string | null
  timezone: string
}) {
  // Both names carry trailing spaces in the live row. Trim at the edge so a
  // stray keystroke during onboarding doesn't become a visible gap in 2.25rem
  // display type.
  const ranch = (ranchName ?? '').trim()
  const owner = (ownerName ?? '').trim()
  const logo  = (logoUrl   ?? '').trim()

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
    <header className="flex items-center gap-3 sm:gap-4 mb-5 sm:mb-7">
      <div
        className="relative flex-shrink-0 rounded-full overflow-hidden grid place-content-center w-14 h-14 sm:w-[76px] sm:h-[76px]"
        style={{
          border: '2px solid var(--accent)',
          boxShadow: '0 0 0 1px rgba(234,88,12,0.18), 0 0 26px rgba(234,88,12,0.16)',
          background: 'var(--surface-1)',
        }}
      >
        {logo ? (
          <Image
            src={logo}
            alt={ranch ? `${ranch} logo` : 'Ranch logo'}
            fill
            sizes="76px"
            className="object-cover"
            priority
          />
        ) : (
          <BrandBookMark size={38} color="var(--accent)" />
        )}
      </div>

      <div className="min-w-0">
        <h1
          className="truncate"
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
