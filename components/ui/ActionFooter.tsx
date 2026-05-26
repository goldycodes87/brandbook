import { ReactNode } from "react";

interface ActionFooterProps {
  /** Primary CTA — use <Button intent="primary"> */
  primary: ReactNode;
  /** Optional secondary button (CANCEL, BACK, etc.) */
  secondary?: ReactNode;
  /** Left-aligned destructive/extra action (DELETE, UNLINK) */
  destructive?: ReactNode;
  /** Helper/hint text rendered above the buttons */
  hint?: ReactNode;
  /** Top divider + extra top margin for separation inside a Panel */
  divided?: boolean;
  className?: string;
}

/**
 * Anchored action row. Sits at the bottom of a Task Form Panel.
 * Primary fills on mobile, inline on ≥sm. Destructive pinned far-left.
 */
export function ActionFooter({
  primary,
  secondary,
  destructive,
  hint,
  divided,
  className = "",
}: ActionFooterProps) {
  return (
    <div
      className={`${divided ? "mt-6 pt-5" : "mt-5"} ${className}`}
      style={
        divided
          ? { borderTop: "1px solid var(--border-subtle)" }
          : undefined
      }
    >
      {hint && <div className="type-helper mb-3">{hint}</div>}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2 sm:gap-3">
        {destructive && (
          <div className="sm:mr-auto">{destructive}</div>
        )}
        {secondary}
        <div className="flex-1 sm:flex-initial">
          <div className="sm:inline-block w-full sm:w-auto [&_button]:w-full sm:[&_button]:w-auto [&_a]:w-full sm:[&_a]:w-auto">
            {primary}
          </div>
        </div>
      </div>
    </div>
  );
}
