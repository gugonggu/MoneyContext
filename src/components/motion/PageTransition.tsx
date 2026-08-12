"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

import { DURATION_FAST } from "@/components/motion/presets";

export function PageTransition({
  children,
  routeKey,
  className,
}: Readonly<{ children: ReactNode; routeKey: string; className?: string }>) {
  return (
    <motion.div
      key={routeKey}
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION_FAST, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
