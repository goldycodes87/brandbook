import { ReactNode } from "react";
import { Tone } from "./tokens";

interface ContextBannerProps {
  tone?: Tone;
  /** Tiny uppercase eyebrow (e.g. "RESUME INTAKE · 2 IN PROGRESS") */
  eyebrow?: ReactNode;
  /** Short headline / subject line */
  title?: ReactNode;
  /** Supporting copy or structured children (resume cards, details) */
  children?: ReactNode;
  /** Right-side actions (buttons, chips) */
  actions?: ReactNode;
  /** Stronger left accent bar */
  emphasis?: boolean;
  className?: string;
}

function toneStyle(tone: Tone): { bg: string; border: string; fg: string } {
  switch (tone) {
    case "success": return { bg: "var(--success-bg)", border: "var(--success-border)", fg: "var(--success-fg)" };
    case "warning": return { bg: "var(--warning-bg)", border: "var(--warning-border)", fg: "var(--warning-fg)" };
    case "danger":  return { bg: "var(--danger-bg)",  border: "var(--danger-border)",  fg: "var(--danger-fg)" };
    case "info":    return { bg: "var(--info-bg)",    border: "var(--info-border)",    fg: "var(--info-fg)" };
    case "accent":  return { bg: "var(--accent-soft)", border: "var(--accent-border)", fg: "var(--accent)" };
    case "gold":    return { bg: "var(--gold-bg)",    border: "var(--gold-border)",    fg: "var(--gold-fg)" };
    case "purple":  return { bg: "var(--purple-bg)",  border: "var(--purple-border)",  fg: "var(--purple-fg)" };
    case "neutral":
    default:        return { bg: "var(--surface-2)",  border: "var(--border)",         fg: "var(--text-secondary)" };
  }
}

/**
 * Operational context surface — banners for next serial, resume intake,
 * pending attempts, success confirmations, error states. First-class UI,
 * not a cloud of ad-hoc divs.
 */
export function ContextBanner({
  tone = "neutral",
  eyebrow,
  title,
  children,
  actions,
  emphasis,
  className = "",
}: ContextBannerProps) {
  const s = toneStyle(tone);
  return (
    <div
      className={`rounded-lg p-4 ${className}`}
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderLeft: emphasis ? `3px solid ${s.fg}` : `1px solid ${s.border}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div className="type-section-label mb-1.5" style={{ color: s.fg }}>
              {eyebrow}
            </div>
          )}
          {title && (
            <div className="type-panel-title mb-1" style={{ color: s.fg }}>
              {title}
            </div>
          )}
          {children && (
            <div className="type-helper" style={{ color: "var(--text-secondary)" }}>
              {children}
            </div>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
