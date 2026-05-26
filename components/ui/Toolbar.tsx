import { HTMLAttributes, ReactNode } from "react";

interface ToolbarProps extends HTMLAttributes<HTMLDivElement> {
  /** Left-side controls (filters, tabs, search). */
  leading?: ReactNode;
  /** Right-side controls (primary action, sort). */
  trailing?: ReactNode;
  /** Flatten vertical padding for compact toolbars above tables. */
  dense?: boolean;
}

/**
 * Horizontal toolbar row — filter chips, search, primary action.
 * Wraps onto two rows on narrow screens without clipping.
 *
 *   <Toolbar
 *     leading={<SearchField placeholder="Search..." />}
 *     trailing={<Button>SYNC</Button>}
 *   />
 */
export function Toolbar({
  leading,
  trailing,
  dense,
  className = "",
  children,
  ...rest
}: ToolbarProps) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 sm:gap-3 ${
        dense ? "py-1.5" : "py-2"
      } ${className}`}
      {...rest}
    >
      {leading && (
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          {leading}
        </div>
      )}
      {children && <div className="flex-1 min-w-0">{children}</div>}
      {trailing && (
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0 ml-auto">
          {trailing}
        </div>
      )}
    </div>
  );
}
