import { cx } from "@/components/ui/cx";

export type StatTone = "neutral" | "positive" | "negative";
export type StatTileVariant = "plain" | "glass";

const TONE_CLASSES: Record<StatTone, string> = {
  neutral: "text-content-primary",
  positive: "text-positive-600 dark:text-positive-500",
  negative: "text-negative-600 dark:text-negative-500",
};

const VARIANT_CLASSES: Record<StatTileVariant, string> = {
  plain: "border border-border-subtle bg-surface-raised shadow-card",
  glass: "glass-surface border border-white/40 dark:border-white/5",
};

export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  variant = "plain",
  className,
}: Readonly<{ label: string; value: string; hint?: string; tone?: StatTone; variant?: StatTileVariant; className?: string }>) {
  return (
    <div className={cx("rounded-tile p-4", VARIANT_CLASSES[variant], className)}>
      <p className="text-xs font-medium text-content-secondary">{label}</p>
      <p className={cx("mt-1 text-xl font-bold tracking-tight tabular-nums sm:text-2xl", TONE_CLASSES[tone])}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-content-muted">{hint}</p> : null}
    </div>
  );
}
