import { cx } from "@/components/ui/cx";

const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function Ring({
  ratio,
  label,
  caption,
  className,
}: Readonly<{ ratio: number; label: string; caption?: string; className?: string }>) {
  const safe = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  const percent = Math.round(safe * 100);

  return (
    <div className={cx("flex items-center gap-3", className)}>
      <svg viewBox="0 0 64 64" role="img" aria-label={`${label} ${percent}%`} className="h-16 w-16 shrink-0">
        <circle
          cx="32"
          cy="32"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-border-subtle"
        />
        <circle
          cx="32"
          cy="32"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - safe)}
          transform="rotate(-90 32 32)"
          className="text-brand-500"
        />
      </svg>
      <div className="min-w-0">
        <p className="text-xs font-medium text-content-secondary">{label}</p>
        <p className="text-lg font-bold tabular-nums text-content-primary">{percent}%</p>
        {caption ? <p className="text-xs text-content-muted">{caption}</p> : null}
      </div>
    </div>
  );
}
