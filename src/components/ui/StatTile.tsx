import { cx } from "@/components/ui/cx";

export type StatTone = "neutral" | "positive" | "negative";

const TONE_CLASSES: Record<StatTone, string> = {
  neutral: "text-content-primary",
  positive: "text-positive-600 dark:text-positive-500",
  negative: "text-negative-600 dark:text-negative-500",
};

export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  className,
}: Readonly<{ label: string; value: string; hint?: string; tone?: StatTone; className?: string }>) {
  return (
    <div className={cx("rounded-tile border border-border-subtle bg-surface-raised p-4 shadow-card", className)}>
      <p className="text-xs font-medium text-content-secondary">{label}</p>
      <p className={cx("mt-1 text-xl font-bold tracking-tight tabular-nums sm:text-2xl", TONE_CLASSES[tone])}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-content-muted">{hint}</p> : null}
    </div>
  );
}
