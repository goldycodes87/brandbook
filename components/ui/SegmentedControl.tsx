"use client";

import { ReactNode } from "react";

export interface SegmentItem<V extends string = string> {
  value: V;
  label: ReactNode;
  disabled?: boolean;
}

interface SegmentedControlProps<V extends string = string> {
  value: V;
  onChange: (next: V) => void;
  items: SegmentItem<V>[];
  /** Grow to fill container */
  block?: boolean;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}

/**
 * Fixed-width segmented picker — ideal for 2–4 mutually-exclusive options
 * (shipping mode, brand toggle, billet length 37/28/18).
 */
export function SegmentedControl<V extends string = string>({
  value,
  onChange,
  items,
  block,
  size = "md",
  className = "",
  "aria-label": ariaLabel,
}: SegmentedControlProps<V>) {
  const h = size === "sm" ? "h-8 text-[11px]" : "h-10 text-xs";
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex rounded-[6px] p-0.5 ${block ? "w-full" : ""} ${className}`}
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
      }}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={item.disabled}
            onClick={() => !item.disabled && onChange(item.value)}
            className={[
              "type-button flex items-center justify-center px-3 rounded-[4px]",
              "transition-[background,color] duration-150",
              h,
              block ? "flex-1" : "",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            ].join(" ")}
            style={{
              background: active ? "var(--accent)" : "transparent",
              color: active ? "var(--accent-on)" : "var(--text-muted)",
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
