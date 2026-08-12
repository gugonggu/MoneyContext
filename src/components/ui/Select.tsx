import type { ReactNode, SelectHTMLAttributes } from "react";

import { cx } from "@/components/ui/cx";
import { inputClasses } from "@/components/ui/TextField";

export function Select({
  label,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
      {label}
      <select {...props} className={cx(inputClasses, "appearance-none bg-no-repeat", className)}>
        {children}
      </select>
    </label>
  );
}
