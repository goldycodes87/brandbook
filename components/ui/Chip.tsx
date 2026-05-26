import { HTMLAttributes, ReactNode } from "react";
import { Tone, ChipPreset, resolveChip } from "./tokens";

type ChipSize = "sm" | "md";

interface ChipProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  tone?: Tone;
  size?: ChipSize;
  icon?: ReactNode;
  children: ReactNode;
}

const SIZE_CLASSES: Record<ChipSize, string> = {
  sm: "px-1.5 h-[18px] text-[10px] gap-1",
  md: "px-2 h-[22px] text-[11px] gap-1.5",
};

function toneStyle(tone: Tone): React.CSSProperties {
  switch (tone) {
    case "success":
      return { background: "var(--success-bg)", color: "var(--success-fg)", border: "1px solid var(--success-border)" };
    case "warning":
      return { background: "var(--warning-bg)", color: "var(--warning-fg)", border: "1px solid var(--warning-border)" };
    case "danger":
      return { background: "var(--danger-bg)", color: "var(--danger-fg)", border: "1px solid var(--danger-border)" };
    case "info":
      return { background: "var(--info-bg)", color: "var(--info-fg)", border: "1px solid var(--info-border)" };
    case "accent":
      return { background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--accent-border)" };
    case "gold":
      return { background: "var(--gold-bg)", color: "var(--gold-fg)", border: "1px solid var(--gold-border)" };
    case "purple":
      return { background: "var(--purple-bg)", color: "var(--purple-fg)", border: "1px solid var(--purple-border)" };
    case "neutral":
    default:
      return { background: "var(--neutral-bg)", color: "var(--neutral-fg)", border: "1px solid var(--neutral-border)" };
  }
}

/**
 * Compact status pill. Use StatusChip below for preset-driven stage/payment/invoice.
 *
 *   <Chip tone="success">PAID</Chip>
 *   <Chip tone="gold" icon="★">PRO</Chip>
 */
export function Chip({
  tone = "neutral",
  size = "md",
  icon,
  className = "",
  children,
  ...rest
}: ChipProps) {
  return (
    <span
      className={[
        "type-chip inline-flex items-center rounded-[3px] whitespace-nowrap",
        SIZE_CLASSES[size],
        className,
      ].join(" ")}
      style={toneStyle(tone)}
      {...rest}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}

interface StatusChipProps {
  /** Preset map (PAYMENT_CHIP, STAGE_CHIP, INVOICE_CHIP, BRAND_CHIP) */
  map: Record<string, ChipPreset>;
  /** Raw key — preset is resolved with a neutral fallback if unknown */
  value: string | null | undefined;
  size?: ChipSize;
  className?: string;
}

/**
 * Preset-driven chip. Consolidates the three duplicate badge maps that were
 * inlined in stage-list.tsx, dugout/page.tsx, and dugout-notes.tsx.
 *
 *   import { PAYMENT_CHIP } from "@/app/components/ui/tokens";
 *   <StatusChip map={PAYMENT_CHIP} value={record.payment_status} />
 */
export function StatusChip({ map, value, size = "md", className }: StatusChipProps) {
  const preset = resolveChip(map, value);
  return (
    <Chip tone={preset.tone} size={size} icon={preset.icon} className={className}>
      {preset.label}
    </Chip>
  );
}
