import { cx } from "@/components/ui/cx";

const WIDTH = 100;
const HEIGHT = 28;

function toPoints(values: readonly number[]): string {
  if (values.length === 0) return "";

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min;
  const stepX = values.length === 1 ? 0 : WIDTH / (values.length - 1);

  return values
    .map((value, index) => {
      const ratio = span === 0 ? 0.5 : (value - min) / span;
      const y = HEIGHT - ratio * HEIGHT;
      return `${(index * stepX).toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function Sparkline({
  values,
  label,
  className,
}: Readonly<{ values: readonly number[]; label: string; className?: string }>) {
  const points = toPoints(values);

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className={cx("h-7 w-full overflow-visible", className)}
    >
      {points ? (
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </svg>
  );
}
