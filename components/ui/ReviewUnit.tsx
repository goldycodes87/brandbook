import { ReactNode } from "react";

interface ReviewUnitProps {
  /** Optional top banner (success/error message, flag) */
  banner?: ReactNode;
  /** Left-side source content (e.g. Shopify order) */
  source: ReactNode;
  /** Right-side target/candidate content (e.g. Vault results) */
  target: ReactNode;
  /** Action row rendered at the bottom of the target column */
  actions?: ReactNode;
  /**
   * Optional full-width footer rendered BELOW the source/target grid.
   * Used by /shopify-review for the inline ASSIGN SERIALS panel where the
   * editable per-bat rows need to span the whole card width.
   */
  footer?: ReactNode;
  className?: string;
}

/**
 * Review / matching archetype unit. Source on the left, target on the right.
 * Stacks on <lg. Used by /shopify-review, /splitgrip/serials review cards.
 */
export function ReviewUnit({ banner, source, target, actions, footer, className = "" }: ReviewUnitProps) {
  return (
    <div
      className={`rounded-lg overflow-hidden ${className}`}
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
      }}
    >
      {banner}
      <div className="grid grid-cols-1 lg:grid-cols-2">
        <div
          className="p-4 sm:p-5"
          style={{
            borderRight: "1px solid var(--border-subtle)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          {source}
        </div>
        <div className="p-4 sm:p-5 flex flex-col">
          <div className="flex-1">{target}</div>
          {actions && (
            <div
              className="flex items-center gap-2 mt-4 pt-3 flex-wrap"
              style={{ borderTop: "1px solid var(--border-subtle)" }}
            >
              {actions}
            </div>
          )}
        </div>
      </div>
      {footer && (
        <div
          className="p-4 sm:p-5"
          style={{ borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
