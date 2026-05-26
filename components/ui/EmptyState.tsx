import { ReactNode } from "react";

export type EmptyStateVariant =
  | "neutral"   /* no records yet, no action needed */
  | "action"    /* prompt the user to create something */
  | "success"   /* all caught up — healthy state */
  | "loading";  /* initializing */

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  /** Short uppercase headline */
  title: ReactNode;
  /** Supporting sentence */
  body?: ReactNode;
  /** Optional CTA (Button / ButtonLink) */
  action?: ReactNode;
  /** Custom icon override (defaults to a variant-specific glyph) */
  icon?: ReactNode;
  /** Wrap inside a Panel-style bordered surface. Default true. */
  panel?: boolean;
  className?: string;
}

const DEFAULT_ICON: Record<EmptyStateVariant, ReactNode> = {
  neutral: (
    <svg viewBox="0 0 48 48" fill="none" className="w-12 h-12" aria-hidden="true">
      <rect x="6" y="10" width="36" height="28" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 18h36" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 14h.01M20 14h.01M26 14h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  action: (
    <svg viewBox="0 0 48 48" fill="none" className="w-12 h-12" aria-hidden="true">
      <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="1.5" />
      <path d="M24 16v16M16 24h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  success: (
    <svg viewBox="0 0 48 48" fill="none" className="w-12 h-12" aria-hidden="true">
      <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="1.5" />
      <path d="m16 24 6 6 12-12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  loading: (
    <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10 animate-spin" aria-hidden="true">
      <circle cx="24" cy="24" r="18" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M42 24a18 18 0 0 0-18-18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
};

function iconColor(variant: EmptyStateVariant): string {
  switch (variant) {
    case "success": return "var(--success-fg)";
    case "action":  return "var(--accent)";
    case "loading": return "var(--text-secondary)";
    default:        return "var(--text-muted)";
  }
}

/**
 * Formal empty/loading states. Use in place of bare <p>No records</p>.
 *
 *   <EmptyState
 *     variant="action"
 *     title="No orders yet"
 *     body="Create your first order to get started."
 *     action={<ButtonLink href="/pull">+ CREATE ORDER</ButtonLink>}
 *   />
 *
 *   <EmptyState variant="loading" title="Loading the Dugout..." />
 */
export function EmptyState({
  variant = "neutral",
  title,
  body,
  action,
  icon,
  panel = true,
  className = "",
}: EmptyStateProps) {
  const content = (
    <div
      className={`flex flex-col items-center text-center px-6 py-12 sm:py-16 ${className}`}
    >
      <div
        className="mb-4 flex items-center justify-center rounded-full"
        style={{
          color: iconColor(variant),
          background:
            variant === "action"
              ? "var(--accent-soft)"
              : variant === "success"
                ? "var(--success-bg)"
                : "var(--surface-2)",
          border: `1px solid ${
            variant === "action"
              ? "var(--accent-border)"
              : variant === "success"
                ? "var(--success-border)"
                : "var(--border)"
          }`,
          width: 72,
          height: 72,
        }}
      >
        {icon ?? DEFAULT_ICON[variant]}
      </div>
      <h3 className="type-empty-title mb-1.5" style={{ color: "var(--text)" }}>
        {title}
      </h3>
      {body && (
        <p className="type-empty-body max-w-sm" style={{ color: "var(--text-muted)" }}>
          {body}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );

  if (!panel) return content;

  return (
    <div
      className="rounded-lg"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
      }}
    >
      {content}
    </div>
  );
}
