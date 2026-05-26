"use client";

import { ReactNode } from "react";

export interface TabItem<V extends string = string> {
  value: V;
  label: ReactNode;
  /** Optional right-aligned counter chip (e.g. "12") */
  count?: number | string;
  disabled?: boolean;
}

interface TabsProps<V extends string = string> {
  value: V;
  onChange: (next: V) => void;
  items: TabItem<V>[];
  /** Fill the container width, evenly splitting tabs */
  stretch?: boolean;
  className?: string;
}

/**
 * Underline tabs — horizontal scroll on narrow screens.
 *
 *   <Tabs value={tab} onChange={setTab} items={[
 *     { value: "orders", label: "ORDERS" },
 *     { value: "shipping", label: "SHIPPING LEDGER", count: 4 },
 *     { value: "settings", label: "SETTINGS" },
 *   ]} />
 */
export function Tabs<V extends string = string>({
  value,
  onChange,
  items,
  stretch,
  className = "",
}: TabsProps<V>) {
  return (
    <div
      className={`overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 ${className}`}
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div className={`flex ${stretch ? "w-full" : ""}`} role="tablist">
        {items.map((item) => {
          const active = item.value === value;
          return (
            <button
              key={item.value}
              role="tab"
              aria-selected={active}
              disabled={item.disabled}
              onClick={() => !item.disabled && onChange(item.value)}
              className={[
                "type-nav-item flex items-center gap-2 px-4 py-3 whitespace-nowrap",
                "transition-colors duration-150",
                stretch ? "flex-1 justify-center" : "",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              ].join(" ")}
              style={{
                color: active ? "var(--text)" : "var(--text-muted)",
                borderBottom: active
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
                marginBottom: "-1px",
              }}
            >
              <span>{item.label}</span>
              {item.count !== undefined && (
                <span
                  className="type-chip inline-flex items-center rounded-[3px] px-1.5 h-[18px]"
                  style={{
                    background: active ? "var(--accent-soft)" : "var(--neutral-bg)",
                    color: active ? "var(--accent)" : "var(--neutral-fg)",
                    border: `1px solid ${active ? "var(--accent-border)" : "var(--neutral-border)"}`,
                  }}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
