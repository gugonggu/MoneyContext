import type { HTMLAttributes } from "react";

import { cx } from "@/components/ui/cx";

export function Surface({
  blur = "md",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { blur?: "sm" | "md" }) {
  return (
    <div
      {...props}
      className={cx("glass-surface", blur === "sm" ? "backdrop-blur-md" : "backdrop-blur-xl", className)}
    />
  );
}
