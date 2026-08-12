// src/components/motion/presets.ts
// motion 트랜지션 상수. 컴포넌트가 직접 숫자를 쓰지 않게 하여
// 앱 전체의 모션 성격을 한 곳에서 조정한다.
import type { Transition, Variants } from "motion/react";

export const DURATION_FAST = 0.12;
export const DURATION_BASE = 0.22;

export const springSoft: Transition = { type: "spring", stiffness: 260, damping: 32, mass: 0.9 };
export const springSnappy: Transition = { type: "spring", stiffness: 420, damping: 34, mass: 0.7 };
export const springGentle: Transition = { type: "spring", stiffness: 160, damping: 26, mass: 1 };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};
