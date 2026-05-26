"use client";

import { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

/* ============================================================================
 * Dense, dark-mode-native table primitive. Handles:
 *   - sticky header
 *   - row hover
 *   - row selection state
 *   - alignment shortcuts (<TD align="right">)
 *   - zero bottom-border on last row (panels handle the boundary)
 *
 * Table renders a <table> with overflow-x scrolling. Wrap in <Panel padding="none">.
 * For card-on-mobile layouts, render the mobile cards conditionally (md:hidden)
 * alongside the Table (hidden md:block) — see stage-list.tsx for the pattern.
 * ==========================================================================*/

export function Table({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table
        className={`w-full border-collapse ${className}`}
        {...rest}
      >
        {children}
      </table>
    </div>
  );
}

export function THead({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  /* Per BERGBAT_REDESIGN_PROMPT.md §"Tables":
     "Header row: background var(--bg-surface), border-bottom 1px
     var(--border-subtle)."  --bg-surface = --surface-1 (chrome
     elevation). Header sitting one elevation BELOW data-row hover
     (--surface-2) reads as recessed chrome — hovered rows feel "above"
     the header, which is the prompt's intended elevation cue. */
  return (
    <thead
      className={className}
      style={{
        background: "var(--surface-1)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
      {...rest}
    >
      {children}
    </thead>
  );
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

/** Totals/summary row section. Use for shipping ledgers and invoice tables. */
export function TFoot({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  /* TFoot mirrors THead chrome elevation (--surface-1) so totals/summary
     rows read as part of the table chrome rather than as bonus data
     rows. Border-top kept at default tier (--border) for the slightly
     stronger "summary divider" cue. */
  return (
    <tfoot
      className={className}
      style={{
        background: "var(--surface-1)",
        borderTop: "1px solid var(--border)",
      }}
      {...rest}
    >
      {children}
    </tfoot>
  );
}

interface TRProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Pointer cursor + hover surface change */
  interactive?: boolean;
  /** Highlighted state (e.g. bulk-select checked row) */
  selected?: boolean;
  /** Row has a warning/flag (e.g. INCOMPLETE Shopify order) */
  flagged?: boolean;
  /** Optional accent color for the left border (e.g. partner identity).
   *  `flagged` (warning) wins when both are set. */
  accent?: string;
}

export function TR({
  interactive,
  selected,
  flagged,
  accent,
  className = "",
  style,
  children,
  ...rest
}: TRProps) {
  const borderLeft = flagged
    ? "3px solid var(--warning-fg)"
    : accent
      ? `3px solid ${accent}`
      : undefined;
  return (
    <tr
      className={[
        interactive ? "cursor-pointer transition-colors" : "",
        "[&:last-child>td]:border-b-0",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        borderBottom: "1px solid var(--border-subtle)",
        background: selected ? "var(--accent-soft)" : undefined,
        borderLeft,
        ...style,
      }}
      onMouseEnter={
        interactive && !selected
          ? (e) => (e.currentTarget.style.background = "var(--surface-2)")
          : undefined
      }
      onMouseLeave={
        interactive && !selected
          ? (e) => (e.currentTarget.style.background = "transparent")
          : undefined
      }
      {...rest}
    >
      {children}
    </tr>
  );
}

interface THProps extends ThHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "center" | "right";
  /** Enable if column is sortable — renders with hover cursor */
  sortable?: boolean;
}

export function TH({
  align = "left",
  sortable,
  className = "",
  children,
  ...rest
}: THProps) {
  return (
    <th
      scope="col"
      className={[
        /* Per BERGBAT_REDESIGN_PROMPT.md §"Tables":
           "Padding: 12px 16px per cell." (py-3 px-4) — denser values
           caused fast-scan read errors on dense rows. scope="col"
           covers prompt §8 a11y checklist — proper TH semantics for
           screen readers across every table in the app. */
        "type-table-header px-4 py-3",
        `text-${align}`,
        sortable ? "cursor-pointer select-none" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </th>
  );
}

interface TDProps extends TdHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "center" | "right";
  /** Muted variant for secondary text (dates, counts) */
  muted?: boolean;
  /** Tabular-nums for numeric alignment */
  numeric?: boolean;
}

export function TD({
  align = "left",
  muted,
  numeric,
  className = "",
  style,
  children,
  ...rest
}: TDProps) {
  return (
    <td
      className={[
        /* Padding pair matches THead per prompt §"Tables": 12px 16px. */
        "type-table-cell px-4 py-3",
        `text-${align}`,
        numeric ? "type-mono" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        color: muted ? "var(--text-muted)" : "var(--text)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </td>
  );
}
