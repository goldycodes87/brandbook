export type Tone =
  | "neutral" | "success" | "warning"
  | "danger" | "info" | "accent"
  | "gold" | "purple";

export interface ChipPreset {
  label: string;
  tone: Tone;
  icon?: string;
}

export const ANIMAL_STATUS_CHIP: Record<string, ChipPreset> = {
  active:      { label: "ACTIVE",      tone: "success", icon: "●" },
  sold:        { label: "SOLD",        tone: "neutral" },
  deceased:    { label: "DECEASED",    tone: "danger" },
  transferred: { label: "TRANSFERRED", tone: "info" },
};

export const SEX_CHIP: Record<string, ChipPreset> = {
  bull:   { label: "BULL",   tone: "accent" },
  cow:    { label: "COW",    tone: "success" },
  heifer: { label: "HEIFER", tone: "gold" },
  steer:  { label: "STEER",  tone: "neutral" },
  calf:   { label: "CALF",   tone: "purple" },
};

export const HEALTH_EVENT_CHIP: Record<string, ChipPreset> = {
  treatment: { label: "TREATMENT", tone: "info" },
  vaccine:   { label: "VACCINE",   tone: "success" },
  vet_visit: { label: "VET VISIT", tone: "purple" },
  illness:   { label: "ILLNESS",   tone: "danger" },
  bcs_log:   { label: "BCS LOG",   tone: "neutral" },
};

export const WITHDRAWAL_CHIP: Record<string, ChipPreset> = {
  active: { label: "IN WITHDRAWAL", tone: "danger",  icon: "⚠" },
  clear:  { label: "CLEAR",         tone: "success", icon: "✓" },
};

export const REPRO_CHIP: Record<string, ChipPreset> = {
  bred:              { label: "BRED",         tone: "info" },
  confirmed:         { label: "CONFIRMED",    tone: "gold" },
  open:              { label: "OPEN",         tone: "warning" },
  calved:            { label: "CALVED",       tone: "success" },
  lost:              { label: "LOST",         tone: "danger" },
  weaned:            { label: "WEANED",       tone: "neutral" },
  preg_check:        { label: "PREG CHECK",   tone: "purple" },
  flushed:           { label: "FLUSHED",      tone: "accent" },
  bse:               { label: "BSE",          tone: "neutral" },
  semen_collection:  { label: "SEMEN COLL.",  tone: "neutral" },
};

export const LEASE_STATUS_CHIP: Record<string, ChipPreset> = {
  active:        { label: "ACTIVE",   tone: "success" },
  expiring_soon: { label: "EXPIRING", tone: "warning", icon: "!" },
  expired:       { label: "EXPIRED",  tone: "danger" },
};

export const INVOICE_STATUS_CHIP: Record<string, ChipPreset> = {
  draft: { label: "DRAFT", tone: "neutral" },
  sent:  { label: "SENT",  tone: "info",    icon: "✉" },
  paid:  { label: "PAID",  tone: "success", icon: "✓" },
};

export function resolveChip(
  map: Record<string, ChipPreset>,
  key: string | null | undefined,
  fallback: ChipPreset = { label: (key || "UNKNOWN").toUpperCase(), tone: "neutral" }
): ChipPreset {
  if (!key) return fallback;
  return map[key] ?? { ...fallback, label: key.toUpperCase().replace(/_/g, " ") };
}
