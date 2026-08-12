"use client";

import { motion } from "motion/react";
import { Children, type ReactNode } from "react";

import { fadeUp, springSoft } from "@/components/motion/presets";

export function Stagger({
  children,
  className,
  step = 0.04,
}: Readonly<{ children: ReactNode; className?: string; step?: number }>) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: step } } }}
    >
      {Children.map(children, (child, index) => (
        <motion.div key={index} variants={fadeUp} transition={springSoft}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
