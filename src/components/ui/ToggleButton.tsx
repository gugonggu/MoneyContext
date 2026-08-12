import type { ButtonHTMLAttributes } from "react";

import { cx } from "@/components/ui/cx";

/**
 * Presentational wrapper for the `role="radio"`/`role="checkbox"` custom
 * button pattern used for type switchers and tag pickers. Callers still own
 * `role`, `aria-checked`, and `onClick` — this only adds active/inactive
 * styling driven by the same `aria-checked` value they already pass.
 */
export function ToggleButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const active = props["aria-checked"] === true || props["aria-checked"] === "true";
  return (
    <button
      {...props}
      className={cx(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
        className,
      )}
    />
  );
}
