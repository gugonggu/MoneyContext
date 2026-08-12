import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "@/components/ui/cx";

export type AlertKind = "error" | "success" | "info";

const KIND_CLASSES: Record<AlertKind, string> = {
  error: "border-negative-100 bg-negative-50 text-negative-700 dark:border-negative-500/30 dark:bg-negative-500/10 dark:text-negative-500",
  success: "border-positive-100 bg-positive-50 text-positive-700 dark:border-positive-500/30 dark:bg-positive-500/10 dark:text-positive-500",
  info: "border-brand-100 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400",
};

export function Alert({
  kind,
  role,
  className,
  ...props
}: Readonly<{ kind: AlertKind; role: "alert" | "status"; children: ReactNode }> & Omit<HTMLAttributes<HTMLParagraphElement>, "children">) {
  return (
    <p
      {...props}
      role={role}
      aria-live={role === "status" ? "polite" : undefined}
      className={cx("rounded-lg border px-3 py-2 text-sm", KIND_CLASSES[kind], className)}
    />
  );
}
