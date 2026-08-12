import type { HTMLAttributes } from "react";

import { cx } from "@/components/ui/cx";

export type CardVariant = "plain" | "glass" | "gradient";

const VARIANT_CLASSES: Record<CardVariant, string> = {
  plain: "border border-border-subtle bg-surface-raised shadow-card",
  glass: "glass-surface border border-white/40 dark:border-white/5",
  gradient:
    "border border-brand-500/20 bg-gradient-to-br from-brand-600 via-brand-500 to-sky-400 text-white shadow-lifted",
};

export function Card({
  variant = "plain",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }) {
  return <div {...props} className={cx("rounded-card p-5 sm:p-6", VARIANT_CLASSES[variant], className)} />;
}
