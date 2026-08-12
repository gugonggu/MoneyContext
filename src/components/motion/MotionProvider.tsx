// src/components/motion/MotionProvider.tsx
"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

import { springSoft } from "@/components/motion/presets";

// reducedMotion="user"가 prefers-reduced-motion: reduce를 전역으로 존중한다.
// 이 설정 아래에서는 위치/스케일 애니메이션이 제거되고 opacity만 남는다.
export function MotionProvider({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <MotionConfig reducedMotion="user" transition={springSoft}>
      {children}
    </MotionConfig>
  );
}
