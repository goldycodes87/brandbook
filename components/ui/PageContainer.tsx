import { HTMLAttributes } from "react";

export type PageContainerVariant = "default" | "narrow" | "wide" | "form";

const MAX_WIDTH: Record<PageContainerVariant, string> = {
  default: "max-w-[80rem]",  /* 1280 — Queue/table pages */
  narrow:  "max-w-[64rem]",  /* 1024 — Dashboard */
  wide:    "max-w-[96rem]",  /* 1536 — Inventory/operations */
  form:    "max-w-[40rem]",  /*  640 — Task forms */
};

interface PageContainerProps extends HTMLAttributes<HTMLElement> {
  variant?: PageContainerVariant;
  /** Wrap in <main>. Default true. Set false if parent already renders <main>. */
  as?: "main" | "div";
  /**
   * Extra bottom padding for pages that render a <StickyActionBar> at the end.
   * Adds ~5rem so the sticky bar never covers the final field/button.
   * iOS home-indicator safe area is always applied regardless.
   */
  stickyBar?: boolean;
}

/**
 * Governs page-level width and gutter rhythm. Use at the top of every page.
 *
 *   <PageContainer variant="default"> ... </PageContainer>
 *
 * Archetype mapping:
 *   dashboard          → "narrow"
 *   table / queue      → "default"
 *   task form          → "form"
 *   review / matching  → "wide"
 *   inventory / ops    → "wide"
 *   empty / low-data   → "default"
 */
export function PageContainer({
  variant = "default",
  as = "main",
  stickyBar = false,
  className = "",
  children,
  ...rest
}: PageContainerProps) {
  const Tag = as;
  return (
    <Tag
      className={`min-h-screen-safe ${className}`}
      style={{ background: "var(--surface-0)" }}
      {...rest}
    >
      <div
        className={`${MAX_WIDTH[variant]} mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 ${
          stickyBar ? "pb-24 lg:pb-8" : "pb-4 sm:pb-6 lg:pb-8"
        } pb-safe`}
      >
        {children}
      </div>
    </Tag>
  );
}
