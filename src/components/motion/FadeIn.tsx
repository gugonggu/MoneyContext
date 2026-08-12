"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

import { fadeUp, springSoft } from "@/components/motion/presets";

export function FadeIn({
  children,
  delay = 0,
  className,
}: Readonly<{ children: ReactNode; delay?: number; className?: string }>) {
  return (
    <motion.div
      className={className}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      transition={{ ...springSoft, delay }}
    >
      {children}
    </motion.div>
  );
}
