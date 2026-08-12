"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

import { springSnappy } from "@/components/motion/presets";

export function Pressable({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <motion.div className={className} whileTap={{ scale: 0.97 }} transition={springSnappy}>
      {children}
    </motion.div>
  );
}
