import type { InputHTMLAttributes, ReactNode } from "react";

import { cx } from "@/components/ui/cx";

export const inputClasses =
  "w-full rounded-tile border border-border-strong bg-surface-raised px-3 py-2 text-sm text-content-primary placeholder:text-content-muted disabled:bg-surface-base disabled:text-content-muted";

export function TextField({
  label,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-content-secondary">
      {label}
      <input {...props} className={cx(inputClasses, className)} />
      {hint ? <span className="text-xs font-normal text-content-muted">{hint}</span> : null}
    </label>
  );
}
