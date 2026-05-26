import { HTMLAttributes } from "react";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** CSS height override — default full-line */
  h?: number | string;
  /** CSS width override — default full */
  w?: number | string;
  /** Fully rounded (for avatar/chip placeholders) */
  pill?: boolean;
}

/**
 * Low-emphasis shimmer placeholder. Use in loading states where the layout
 * would otherwise jump (table rows, stat values). For bigger loading states,
 * prefer <EmptyState variant="loading" />.
 */
export function Skeleton({
  h = 14,
  w = "100%",
  pill,
  className = "",
  style,
  ...rest
}: SkeletonProps) {
  return (
    <div
      className={`animate-pulse ${className}`}
      style={{
        background: "var(--surface-2)",
        borderRadius: pill ? 999 : "var(--radius-sm)",
        height: typeof h === "number" ? `${h}px` : h,
        width: typeof w === "number" ? `${w}px` : w,
        ...style,
      }}
      {...rest}
    />
  );
}
