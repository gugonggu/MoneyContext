import type { InputHTMLAttributes, ReactNode } from "react";

import { cx } from "@/components/ui/cx";

export function Checkbox({
  label,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode }) {
  return (
    <label className="flex items-start gap-2 text-sm text-slate-700">
      <input type="checkbox" {...props} className={cx("mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600", className)} />
      <span>{label}</span>
    </label>
  );
}
