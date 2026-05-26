import { ReactNode } from "react";

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  /** Sub-line below the value (trend, comparison, denominator) */
  meta?: ReactNode;
  /** Small decoration in the top-right corner (icon, chip) */
  aside?: ReactNode;
  /**
   * Apply an accent top-border to flag a single hero metric.
   *
   * BERGBAT_REDESIGN_PROMPT.md anti-pattern §9: "NO individual card border
   * accents applied to only one of a group of cards. Consistent or none."
   * Use only when there is genuinely ONE primary metric in the row (e.g. a
   * solo "BATS THIS YEAR" hero in a five-tile bar). Never sprinkle across
   * a 4-up grid.
   */
  emphasis?: boolean;
  /**
   * Override the value color. Defaults to neutral text. Pass a CSS color or
   * `var(--gold-fg)` / `var(--accent)` etc. when the number itself carries
   * semantic weight per prompt §"Stat Cards":
   *   • production counts → var(--gold-fg)
   *   • shipped count     → var(--status-shipped)
   *   • unpaid / alert    → var(--accent)
   *   • zero / inert      → leave as default (var(--text))
   */
  valueColor?: string;
  className?: string;
}

/**
 * Dashboard metric tile. Designed for tight grids:
 *
 *   <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
 *     <StatCard label="2026 PRODUCTION" value={2306} valueColor="var(--gold-fg)" />
 *     ...
 *   </div>
 *
 * Visual contract per BERGBAT_REDESIGN_PROMPT.md §"Stat Cards":
 *   bg            var(--surface-2)        (= prompt's --bg-card)
 *   border        1px var(--border-subtle)
 *   hover border  var(--border)           (= prompt's --border-default)
 *   radius        var(--radius-lg)        (8px)
 *   padding       20px 24px (5 / 6 in Tailwind scale)
 *   transition    border-color 200ms ease — opacity/transform only otherwise
 */
export function StatCard({
  label,
  value,
  meta,
  aside,
  emphasis,
  valueColor,
  className = "",
}: StatCardProps) {
  /* Border lives in classes (not inline style) so the hover variant can
     override it — inline style would otherwise always win for the same
     property. The conditional `emphasis` top-border stays inline because
     it's a different shorthand from the box-wide border. */
  return (
    <div
      className={`rounded-lg px-6 py-5 flex flex-col gap-2 border bg-[color:var(--surface-2)] border-[color:var(--border-subtle)] hover:border-[color:var(--border)] transition-colors duration-200 ${className}`}
      style={
        emphasis
          ? { borderTop: "2px solid var(--accent)" }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="type-metric-label">{label}</div>
        {aside && <div className="flex-shrink-0">{aside}</div>}
      </div>
      <div className="type-metric-value" style={{ color: valueColor ?? "var(--text)" }}>
        {value}
      </div>
      {meta && <div className="type-helper">{meta}</div>}
    </div>
  );
}
