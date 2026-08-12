import { cx } from "@/components/ui/cx";

export function Skeleton({ className }: Readonly<{ className?: string }>) {
  return <div aria-hidden="true" className={cx("animate-pulse rounded-tile bg-border-subtle", className)} />;
}
