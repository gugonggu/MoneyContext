import type { ButtonHTMLAttributes } from "react";

import { cx } from "@/components/ui/cx";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700 disabled:bg-slate-300",
  secondary: "bg-white text-slate-700 border border-slate-300 shadow-sm hover:bg-slate-50 disabled:text-slate-400",
  danger: "bg-negative-600 text-white shadow-sm hover:bg-negative-700 disabled:bg-slate-300",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100 disabled:text-slate-400",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed",
        VARIANT_CLASSES[variant],
        className,
      )}
    />
  );
}
