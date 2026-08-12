import type { InputHTMLAttributes, ReactNode } from "react";

import { cx } from "@/components/ui/cx";

export function Checkbox({
  label,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode }) {
  return (
    <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
      <input
        type="checkbox"
        {...props}
        className={cx("mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600 dark:border-slate-600 dark:bg-slate-800", className)}
      />
      <span>{label}</span>
    </label>
  );
}
