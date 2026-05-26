"use client";

import {
  forwardRef,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
  useId,
} from "react";

/* ============================================================================
 * Field — composable label + control + helper + error wrapper.
 *
 *   <Field label="Customer name" helper="First and last" required>
 *     <Input value={name} onChange={(e) => setName(e.target.value)} />
 *   </Field>
 *
 * Field passes an id via React Context isn't used — we rely on `htmlFor`
 * wiring via the label prop and an explicit `id` on the control. If you omit
 * an id, the label renders un-associated (fine for stacked usage).
 * ==========================================================================*/
interface FieldProps {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  /** Right-side note (e.g. char count) */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Field({
  label,
  helper,
  error,
  required,
  htmlFor,
  aside,
  className = "",
  children,
}: FieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {(label || aside) && (
        <div className="flex items-end justify-between gap-2">
          {label && (
            <label htmlFor={htmlFor} className="type-field-label">
              {label}
              {required && (
                <span style={{ color: "var(--danger-fg)" }} className="ml-1">*</span>
              )}
            </label>
          )}
          {aside && <span className="type-helper">{aside}</span>}
        </div>
      )}
      {children}
      {(helper || error) && (
        <div
          className="type-helper"
          style={{ color: error ? "var(--danger-fg)" : "var(--text-muted)" }}
        >
          {error || helper}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

/* Per BERGBAT_REDESIGN_PROMPT.md §"Form Inputs":
 *   bg            var(--bg-input)        (#141414 — recessed below cards)
 *   border        1px var(--border)       (= prompt's --border-default)
 *   radius        var(--radius-md)        (8px)
 *   height        40px (.h-10)
 *   padding       0 12px (.px-3)
 *   font          Inter 400, 14px
 *   focus         border-color var(--border-strong);
 *                 box-shadow: 0 0 0 3px var(--accent-soft) [3px brand-dim ring]
 *                 (Global focus styling lives in globals.css `input:focus`.)
 */
const CONTROL_BASE =
  "w-full rounded-md px-3 text-[14px] transition-colors " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

interface BaseControlProps {
  invalid?: boolean;
  /** Applies a subtle highlight to flag a value as overridden/required */
  tone?: "default" | "warning";
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & BaseControlProps;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, tone = "default", className = "", style, ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      className={`${CONTROL_BASE} h-10 ${className}`}
      style={{
        background: "var(--bg-input)",
        color: "var(--text)",
        border: `1px solid ${
          invalid
            ? "var(--danger-border)"
            : tone === "warning"
              ? "var(--warning-border)"
              : "var(--border)"
        }`,
        fontFamily: "var(--font-ui)",
        ...style,
      }}
      {...rest}
    />
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & BaseControlProps;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ invalid, className = "", style, rows = 3, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={`${CONTROL_BASE} py-2 ${className}`}
        style={{
          background: "var(--bg-input)",
          color: "var(--text)",
          border: `1px solid ${invalid ? "var(--danger-border)" : "var(--border)"}`,
          fontFamily: "var(--font-ui)",
          ...style,
        }}
        {...rest}
      />
    );
  }
);

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & BaseControlProps;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className = "", style, children, ...rest },
  ref
) {
  return (
    <select
      ref={ref}
      className={`${CONTROL_BASE} h-10 pr-8 appearance-none ${className}`}
      style={{
        /* Custom chevron — fill matches --text-muted (#6B7280 → URL-encoded
           %236B7280). Background sits on var(--bg-input) so the recessed
           input depth matches text/textarea siblings. */
        background:
          "var(--bg-input) url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%236B7280'><path fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z' clip-rule='evenodd'/></svg>\") no-repeat right 0.6rem center / 16px 16px",
        color: "var(--text)",
        border: `1px solid ${invalid ? "var(--danger-border)" : "var(--border)"}`,
        fontFamily: "var(--font-ui)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </select>
  );
});

/* ──────────────────────────────────────────────────────────────────────── */

interface SearchFieldProps extends Omit<InputProps, "type"> {
  /** Fires on ⌘K / Ctrl+K for global search bindings (optional) */
  shortcut?: string;
}

/** Search input with leading magnifier icon. */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(
  function SearchField({ className = "", style, shortcut, ...rest }, ref) {
    const inputId = useId();
    return (
      <div className={`relative ${className}`}>
        <svg
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          style={{ color: "var(--text-muted)" }}
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={ref}
          id={inputId}
          type="search"
          className="w-full h-10 rounded-[4px] pl-9 pr-3 text-[13px] transition-colors"
          style={{
            background: "var(--bg-input)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            fontFamily: "var(--font-ui)",
            ...style,
          }}
          {...rest}
        />
        {shortcut && (
          <kbd
            className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[10px] type-mono"
            style={{
              background: "var(--surface-3)",
              color: "var(--text-muted)",
              border: "1px solid var(--border)",
            }}
          >
            {shortcut}
          </kbd>
        )}
      </div>
    );
  }
);
