import type { ButtonHTMLAttributes } from "react";

import { cx } from "@/components/ui/cx";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-br from-brand-600 to-brand-500 text-white shadow-card hover:from-brand-700 hover:to-brand-600 disabled:from-slate-300 disabled:to-slate-300 dark:disabled:from-slate-700 dark:disabled:to-slate-700",
  secondary:
    "border border-border-strong bg-surface-raised text-content-primary shadow-card hover:bg-surface-base disabled:text-content-muted",
  danger:
    "bg-negative-600 text-white shadow-card hover:bg-negative-700 disabled:bg-slate-300 dark:disabled:bg-slate-700",
  ghost: "bg-transparent text-content-secondary hover:bg-surface-base disabled:text-content-muted",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-3 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-tile font-semibold transition-[background-color,transform,box-shadow] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
    />
  );
}
