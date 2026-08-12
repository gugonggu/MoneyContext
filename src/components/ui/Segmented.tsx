"use client";

import { motion } from "motion/react";
import { useId } from "react";

import { springSnappy } from "@/components/motion/presets";
import { cx } from "@/components/ui/cx";

export type SegmentedOption = Readonly<{ value: string; label: string }>;

export function Segmented({
  label,
  options,
  value,
  onChange,
  className,
}: Readonly<{
  label: string;
  options: readonly SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}>) {
  const indicatorId = useId();

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx("inline-flex gap-1 rounded-pill bg-surface-base p-1", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className="relative rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors"
          >
            {selected ? (
              <motion.span
                layoutId={indicatorId}
                transition={springSnappy}
                className="absolute inset-0 rounded-full bg-surface-raised shadow-card"
              />
            ) : null}
            <span className={cx("relative", selected ? "text-content-primary" : "text-content-secondary")}>
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
