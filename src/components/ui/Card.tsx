import type { HTMLAttributes } from "react";

import { cx } from "@/components/ui/cx";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cx("rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5", className)} />;
}
