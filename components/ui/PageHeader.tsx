import { ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  /** Supporting copy rendered below the title in muted text */
  subtitle?: ReactNode;
  /** Tiny uppercase eyebrow above the title (e.g. "THE DUGOUT", "YARD") */
  eyebrow?: ReactNode;
  /** Right-aligned actions (primary CTA, filter toggles, etc.) */
  actions?: ReactNode;
  /** Secondary content below actions row (e.g. tabs, summary strip) */
  meta?: ReactNode;
}

/**
 * Standardized page header. Handles responsive stacking on <sm.
 *
 *   <PageHeader
 *     title="ON DECK"
 *     subtitle={`${count} orders ready to turn`}
 *     actions={<Button intent="primary">+ ORDER</Button>}
 *   />
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  meta,
}: PageHeaderProps) {
  return (
    <header className="mb-5 sm:mb-7">
      {/* <sm: title stacks, actions move below in their own flex row so long
          titles never squeeze the primary CTA. >=sm: classic side-by-side. */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-6">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div
              className="type-section-label mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              {eyebrow}
            </div>
          )}
          <h1 className="type-page-title" style={{ color: "var(--text)" }}>
            {title}
          </h1>
          {subtitle && (
            <p className="type-page-subtitle mt-1.5">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:flex-shrink-0 -mx-0.5 sm:mx-0">
            {actions}
          </div>
        )}
      </div>
      {meta && <div className="mt-4">{meta}</div>}
    </header>
  );
}
