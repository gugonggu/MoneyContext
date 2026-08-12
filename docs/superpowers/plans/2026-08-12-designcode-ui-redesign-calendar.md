# DesignCode UI 리디자인 + 달력 기록 뷰 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DesignCode UI 킷의 시각 언어를 Money Context 전 화면에 적용하고, 자신의 기록을 달력으로 회고하는 `/calendar` 페이지와 홈 미니 위젯을 추가한다.

**Architecture:** 의미 기반 CSS 토큰을 한 겹 올리고 그 위에 UI 프리미티브를 재작성해 전 화면이 자동으로 개선되게 한다. `motion` import는 `src/components/motion/`에 격리해 페이지를 Server Component로 유지한다. 달력은 순수 도메인 함수(그리드 생성·집계·히트맵·예정 마커)와 월 범위 전용 리포지토리로 나누고, UI는 계산 결과만 그린다.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 6, Tailwind CSS 4, Supabase, motion(구 framer-motion), Vitest + Testing Library, Playwright

> **상태 정합화 (2026-08-12):** Task 1은 `3acaa96`에서, Task 2는 `68f18d4`에서 완료되었으며 각각 독립 검토를 통과했다.

## Global Constraints

- 신규 런타임 의존성은 `motion` **1개만** 추가한다. 차트/아이콘 라이브러리는 추가하지 않고 인라인 SVG로 그린다.
- 재정 계산 로직을 React 컴포넌트에 넣지 않는다. 계산은 `src/domain/`, 조회는 `src/server/`에 둔다 (`AGENTS.md` 3항).
- 달력 합계는 `status === "CONFIRMED"` 이고 `type`이 `INCOME` 또는 `EXPENSE`인 거래만 포함한다. `TRANSFER`·`ADJUSTMENT`는 제외한다 (재정 규칙 1·6).
- 달력 집계 금액은 `amount`가 아니라 `baseAmount`를 쓴다 (재정 규칙 9).
- 예정 거래·카드 결제일·반복 고정비는 마커로만 표시하고 `income`/`expense`/`summary`에 절대 합산하지 않는다 (재정 규칙 7).
- 날짜 키는 `Asia/Seoul` 기준으로 변환한 뒤 `YYYY-MM-DD`로 만든다. `slice(0, 10)`으로 timestamptz를 자르지 않는다.
- 색상만으로 수입/지출/위험을 구분하지 않는다. 금액 텍스트를 병기하고 `aria-label`에 텍스트 요약을 넣는다 (`UI_UX.md` 14항).
- 테스트를 삭제하거나 완화해서 구현을 통과시키지 않는다. 기존 테스트가 마크업 변경으로 깨지면 기대값만 조정하고, 재정 계산을 검증하는 단언은 그대로 둔다 (`AGENTS.md` 5항).
- `motion`을 import하는 파일은 `src/components/motion/` 아래에만 두고 각각 `"use client"`를 선언한다.
- 그라디언트는 히어로 카드와 Primary 버튼에만 쓴다. 메시 그라디언트 배경·노이즈 텍스처·컬러 글로우는 쓰지 않는다.
- 커밋 prefix는 `feat:` `fix:` `refactor:` `test:` `docs:` `chore:` 중 하나를 쓴다.
- 검증 명령: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:e2e`

## File Structure

**신규 생성**

| 파일 | 책임 |
|---|---|
| `src/components/motion/presets.ts` | spring/transition 상수 |
| `src/components/motion/MotionProvider.tsx` | `MotionConfig reducedMotion="user"` |
| `src/components/motion/FadeIn.tsx` | 진입 fade + slide-up |
| `src/components/motion/Stagger.tsx` | 자식 순차 진입 |
| `src/components/motion/Pressable.tsx` | `whileTap` 스케일 |
| `src/components/motion/PageTransition.tsx` | 라우트 전환 래퍼 |
| `src/components/ui/Surface.tsx` | 글래스 서피스 |
| `src/components/ui/StatTile.tsx` | 라벨 + 큰 숫자 + 보조 |
| `src/components/ui/Skeleton.tsx` | 로딩 자리표시 |
| `src/components/ui/Sparkline.tsx` | 순수 SVG 라인 |
| `src/components/ui/Ring.tsx` | 순수 SVG 진행 링 |
| `src/components/ui/Segmented.tsx` | 탭 토글 (layoutId 인디케이터) |
| `src/components/ui/Sheet.tsx` | 바텀시트 / 사이드 패널 |
| `src/components/nav/TopBar.tsx` | 데스크톱 상단바 |
| `src/lib/dates/seoul.ts` | Asia/Seoul 날짜 변환 |
| `src/domain/calendar/types.ts` | 달력 공용 타입 |
| `src/domain/calendar/month.ts` | 그리드·집계·히트맵·`buildCalendarMonth` |
| `src/domain/calendar/upcoming.ts` | 예정 마커 수집 |
| `src/server/calendar/repository.ts` | 월 범위 조회 |
| `src/server/calendar/service.ts` | 조회 결과 → 도메인 조립 |
| `src/server/calendar/index.ts` | `getCalendarMonthForCurrentUser` |
| `src/app/(app)/(shell)/calendar/page.tsx` | 달력 라우트 |
| `src/components/calendar/CalendarMonthView.tsx` | 달력 헤더 + 그리드 + 상세 |
| `src/components/calendar/CalendarGrid.tsx` | 42칸 그리드, 키보드 이동 |
| `src/components/calendar/CalendarDayCell.tsx` | 셀 1개 |
| `src/components/calendar/CalendarDaySheet.tsx` | 날짜 상세 패널 |
| `src/components/calendar/CalendarStrip.tsx` | 홈 미니 위젯 |

**수정**

| 파일 | 변경 |
|---|---|
| `src/app/globals.css` | 의미 토큰 추가 |
| `src/app/layout.tsx` | `MotionProvider` 적용, body 토큰화 |
| `src/components/ui/Card.tsx` | `variant` 추가 |
| `src/components/ui/Button.tsx` | `size` 추가, press 스케일 |
| `src/components/ui/{TextField,Select,Checkbox,ToggleButton,Alert,PageHeader}.tsx` | 토큰화 (props 시그니처 유지) |
| `src/components/nav/AppShell.tsx` | 셸 재작성 |
| `src/components/nav/nav-items.ts` | 달력 항목 추가 |
| `src/server/notifications/repository.ts` | `seoulDate` → 공유 함수 import |
| `src/components/dashboard/DashboardOverview.tsx` | 히어로 + 타일 구조 |
| `src/server/dashboard/index.ts` | 달력 스트립 데이터 추가 |
| `src/components/transactions/QuickEntryForm.tsx` | `defaultDate` prop |
| 각 화면 `page.tsx` / Overview 컴포넌트 | 레이아웃 적용 |

---

## Task 1: 디자인 토큰과 motion 기반

**Files:**
- Modify: `package.json`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Create: `src/components/motion/presets.ts`
- Create: `src/components/motion/MotionProvider.tsx`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces:
  - CSS 유틸리티: `bg-surface-base` `bg-surface-raised` `bg-surface-overlay` `border-border-subtle` `border-border-strong` `text-content-primary` `text-content-secondary` `text-content-muted` `rounded-card` `rounded-tile` `shadow-card` `shadow-lifted`
  - `presets.ts`: `export const springSoft`, `springSnappy`, `springGentle`, `fadeUp`, `DURATION_FAST = 0.12`, `DURATION_BASE = 0.22`
  - `MotionProvider.tsx`: `export function MotionProvider({ children }: { children: ReactNode })`

- [x] **Step 1: `motion` 설치**

```bash
npm install motion
```

- [x] **Step 2: 설치 확인**

Run: `node -e "console.log(require('./package.json').dependencies.motion)"`
Expected: 버전 문자열이 출력된다 (예: `^12.x.x`)

- [x] **Step 3: `globals.css`에 의미 토큰 추가**

`@theme` 블록 **뒤에**, `:root` 블록 **앞에** 다음을 삽입한다. `@theme inline`을 쓰는 이유는 유틸리티가 `--mc-*` 변수를 직접 참조하게 만들어 다크 모드에서 값만 바꿔 끼울 수 있게 하기 위해서다.

```css
/* 의미 기반 토큰. 값은 아래 :root / html[data-theme="dark"]에서 바뀐다.
   @theme inline이라 유틸리티가 --mc-* 를 그대로 참조하므로
   테마 전환 시 클래스 교체 없이 색만 갈아끼워진다. */
@theme inline {
  --color-surface-base: var(--mc-surface-base);
  --color-surface-raised: var(--mc-surface-raised);
  --color-surface-overlay: var(--mc-surface-overlay);

  --color-border-subtle: var(--mc-border-subtle);
  --color-border-strong: var(--mc-border-strong);

  --color-content-primary: var(--mc-content-primary);
  --color-content-secondary: var(--mc-content-secondary);
  --color-content-muted: var(--mc-content-muted);

  --radius-card: 1.25rem;
  --radius-tile: 1rem;

  --shadow-card: var(--mc-shadow-card);
  --shadow-lifted: var(--mc-shadow-lifted);
}

:root {
  --mc-surface-base: #f6f7fb;
  --mc-surface-raised: #ffffff;
  --mc-surface-overlay: rgb(255 255 255 / 0.82);

  --mc-border-subtle: #e6e8ef;
  --mc-border-strong: #cdd2de;

  --mc-content-primary: #0f172a;
  --mc-content-secondary: #495468;
  --mc-content-muted: #7b8598;

  --mc-shadow-card:
    0 1px 2px rgb(15 23 42 / 0.04),
    0 4px 12px rgb(15 23 42 / 0.05),
    0 12px 32px rgb(15 23 42 / 0.04);
  --mc-shadow-lifted:
    0 2px 4px rgb(15 23 42 / 0.06),
    0 8px 24px rgb(15 23 42 / 0.08),
    0 24px 56px rgb(15 23 42 / 0.08);

  --mc-ease-soft: cubic-bezier(0.32, 0.72, 0, 1);
  --mc-ease-snappy: cubic-bezier(0.2, 0.9, 0.3, 1);
}

html[data-theme="dark"] {
  --mc-surface-base: #08090d;
  --mc-surface-raised: #121520;
  --mc-surface-overlay: rgb(18 21 32 / 0.78);

  --mc-border-subtle: #232838;
  --mc-border-strong: #333a4f;

  --mc-content-primary: #f1f4fb;
  --mc-content-secondary: #a5aec4;
  --mc-content-muted: #737e96;

  --mc-shadow-card:
    0 1px 2px rgb(0 0 0 / 0.4),
    0 4px 12px rgb(0 0 0 / 0.35),
    0 12px 32px rgb(0 0 0 / 0.3);
  --mc-shadow-lifted:
    0 2px 4px rgb(0 0 0 / 0.45),
    0 8px 24px rgb(0 0 0 / 0.45),
    0 24px 56px rgb(0 0 0 / 0.4);
}
```

- [x] **Step 4: `globals.css`의 `body` 규칙을 토큰으로 교체**

기존 `body { ... background: var(--color-slate-50); color: var(--color-slate-900); }`와 그 아래 `html[data-theme="dark"] body { ... }` 블록을 다음으로 교체한다.

```css
body {
  margin: 0;
  min-height: 100vh;
  background: var(--mc-surface-base);
  color: var(--mc-content-primary);
  -webkit-font-smoothing: antialiased;
}
```

다크 모드용 `body` 블록은 `--mc-*`가 이미 테마별로 바뀌므로 **삭제한다**.

- [x] **Step 5: 글래스 유틸리티 클래스 추가**

`globals.css` 맨 아래에 추가한다. 1px 인셋 하이라이트는 DesignCode 킷 카드의 상단 광택을 재현한다.

```css
@utility glass-surface {
  background: var(--mc-surface-overlay);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  box-shadow:
    inset 0 1px 0 0 rgb(255 255 255 / 0.5),
    var(--mc-shadow-card);
}

html[data-theme="dark"] .glass-surface {
  box-shadow:
    inset 0 1px 0 0 rgb(255 255 255 / 0.06),
    var(--mc-shadow-card);
}
```

- [x] **Step 6: `presets.ts` 작성**

```ts
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
```

- [x] **Step 7: `MotionProvider.tsx` 작성**

```tsx
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
```

- [x] **Step 8: 루트 레이아웃에 적용**

`src/app/layout.tsx`의 `body`를 다음으로 교체한다.

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

import { MotionProvider } from "@/components/motion/MotionProvider";
import { themeBootstrapScript } from "@/components/theme/theme-script";

export const metadata: Metadata = {
  title: "Money Context",
  description: "개인 재정 기록과 분석을 위한 가계부",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="bg-surface-base font-sans text-content-primary">
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
```

- [x] **Step 9: 타입 검사와 린트**

Run: `npm run typecheck && npm run lint`
Expected: 둘 다 통과

- [x] **Step 10: 기존 테스트가 깨지지 않았는지 확인**

Run: `npm run test`
Expected: 전부 통과 (이 태스크는 마크업 구조를 바꾸지 않았다)

- [x] **Step 11: 커밋**

```bash
git add package.json package-lock.json src/app/globals.css src/app/layout.tsx src/components/motion
git commit -m "feat: add semantic design tokens and motion provider"
```

---

## Task 2: UI 프리미티브 확장 (Card, Button, Surface, StatTile, Skeleton)

**Files:**
- Modify: `src/components/ui/Card.tsx`
- Modify: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Surface.tsx`
- Create: `src/components/ui/StatTile.tsx`
- Create: `src/components/ui/Skeleton.tsx`
- Test: `tests/unit/ui-primitives.test.tsx`

**Interfaces:**
- Consumes: Task 1의 토큰 유틸리티(`bg-surface-raised`, `rounded-card`, `shadow-card`, `glass-surface` 등)
- Produces:
  - `Card`: `({ variant?: "plain" | "glass" | "gradient" } & HTMLAttributes<HTMLDivElement>)`
  - `Button`: `({ variant?: ButtonVariant; size?: "sm" | "md" | "lg" } & ButtonHTMLAttributes<HTMLButtonElement>)` — `ButtonVariant`는 기존 `"primary" | "secondary" | "danger" | "ghost"` 그대로
  - `Surface`: `({ blur?: "sm" | "md" } & HTMLAttributes<HTMLDivElement>)`
  - `StatTile`: `({ label: string; value: string; hint?: string; tone?: "neutral" | "positive" | "negative"; className?: string })`
  - `Skeleton`: `({ className?: string })`

- [x] **Step 1: 실패하는 테스트 작성**

```tsx
// tests/unit/ui-primitives.test.tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { Surface } from "@/components/ui/Surface";

afterEach(cleanup);

describe("Card", () => {
  it("renders a plain surface by default", () => {
    const { container } = render(<Card>내용</Card>);
    const card = container.firstElementChild as HTMLElement;

    expect(card.className).toContain("bg-surface-raised");
    expect(card.className).not.toContain("glass-surface");
  });

  it("renders a glass surface when asked", () => {
    const { container } = render(<Card variant="glass">내용</Card>);

    expect((container.firstElementChild as HTMLElement).className).toContain("glass-surface");
  });

  it("keeps caller class names alongside the variant classes", () => {
    const { container } = render(<Card className="테스트-클래스">내용</Card>);

    expect((container.firstElementChild as HTMLElement).className).toContain("테스트-클래스");
  });
});

describe("Button", () => {
  it("defaults to the primary variant at medium size", () => {
    render(<Button>저장</Button>);
    const button = screen.getByRole("button", { name: "저장" });

    expect(button.className).toContain("text-white");
  });

  it("forwards the disabled attribute", () => {
    render(<Button disabled>저장</Button>);

    expect(screen.getByRole("button", { name: "저장" }).hasAttribute("disabled")).toBe(true);
  });
});

describe("StatTile", () => {
  it("renders the label, the value, and the optional hint", () => {
    render(<StatTile label="순자산" value="1,240,000원" hint="전월 대비 +3.2%" />);

    expect(screen.getByText("순자산")).toBeTruthy();
    expect(screen.getByText("1,240,000원")).toBeTruthy();
    expect(screen.getByText("전월 대비 +3.2%")).toBeTruthy();
  });

  it("omits the hint element when no hint is given", () => {
    render(<StatTile label="지출" value="800,000원" />);

    expect(screen.queryByText("전월 대비 +3.2%")).toBeNull();
  });
});

describe("Surface", () => {
  it("applies the glass treatment", () => {
    const { container } = render(<Surface>내용</Surface>);

    expect((container.firstElementChild as HTMLElement).className).toContain("glass-surface");
  });
});
```

- [x] **Step 2: 테스트를 돌려 실패를 확인**

Run: `npx vitest run tests/unit/ui-primitives.test.tsx`
Expected: FAIL — `Cannot find module '@/components/ui/StatTile'`

- [x] **Step 3: `Card.tsx` 재작성**

```tsx
// src/components/ui/Card.tsx
import type { HTMLAttributes } from "react";

import { cx } from "@/components/ui/cx";

export type CardVariant = "plain" | "glass" | "gradient";

const VARIANT_CLASSES: Record<CardVariant, string> = {
  plain: "border border-border-subtle bg-surface-raised shadow-card",
  glass: "glass-surface border border-white/40 dark:border-white/5",
  gradient:
    "border border-brand-500/20 bg-gradient-to-br from-brand-600 via-brand-500 to-sky-400 text-white shadow-lifted",
};

export function Card({
  variant = "plain",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }) {
  return <div {...props} className={cx("rounded-card p-5 sm:p-6", VARIANT_CLASSES[variant], className)} />;
}
```

- [x] **Step 4: `Button.tsx` 재작성**

```tsx
// src/components/ui/Button.tsx
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
```

- [x] **Step 5: `Surface.tsx` 작성**

```tsx
// src/components/ui/Surface.tsx
import type { HTMLAttributes } from "react";

import { cx } from "@/components/ui/cx";

// 상단바, 하단탭, 시트처럼 뒤 콘텐츠가 비쳐야 하는 표면에 쓴다.
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
```

- [x] **Step 6: `StatTile.tsx` 작성**

```tsx
// src/components/ui/StatTile.tsx
import { cx } from "@/components/ui/cx";

export type StatTone = "neutral" | "positive" | "negative";

const TONE_CLASSES: Record<StatTone, string> = {
  neutral: "text-content-primary",
  positive: "text-positive-600 dark:text-positive-500",
  negative: "text-negative-600 dark:text-negative-500",
};

// 숫자가 주인공이고 색은 조연이다. 라벨은 작게, 값은 크게 둔다.
export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  className,
}: Readonly<{ label: string; value: string; hint?: string; tone?: StatTone; className?: string }>) {
  return (
    <div
      className={cx(
        "rounded-tile border border-border-subtle bg-surface-raised p-4 shadow-card",
        className,
      )}
    >
      <p className="text-xs font-medium text-content-secondary">{label}</p>
      <p className={cx("mt-1 text-xl font-bold tracking-tight tabular-nums sm:text-2xl", TONE_CLASSES[tone])}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-content-muted">{hint}</p> : null}
    </div>
  );
}
```

- [x] **Step 7: `Skeleton.tsx` 작성**

```tsx
// src/components/ui/Skeleton.tsx
import { cx } from "@/components/ui/cx";

export function Skeleton({ className }: Readonly<{ className?: string }>) {
  return (
    <div
      aria-hidden="true"
      className={cx("animate-pulse rounded-tile bg-border-subtle", className)}
    />
  );
}
```

- [x] **Step 8: 테스트 통과 확인**

Run: `npx vitest run tests/unit/ui-primitives.test.tsx`
Expected: PASS (전 12건)

- [x] **Step 9: 전체 스위트 확인**

Run: `npm run typecheck && npm run test`
Expected: 통과. `Card`의 `p-4`가 `p-5`로 바뀌었을 뿐 구조는 그대로라 기존 테스트는 영향받지 않는다. 실패한다면 해당 테스트가 클래스 문자열을 단언하고 있는 것이므로 기대값만 새 클래스로 고친다.

- [x] **Step 10: 커밋**

```bash
git add src/components/ui tests/unit/ui-primitives.test.tsx
git commit -m "feat: extend ui primitives with variants and stat tiles"
```

---

## Task 3: 폼 프리미티브 토큰화

**Files:**
- Modify: `src/components/ui/TextField.tsx`
- Modify: `src/components/ui/Select.tsx`
- Modify: `src/components/ui/Checkbox.tsx`
- Modify: `src/components/ui/ToggleButton.tsx`
- Modify: `src/components/ui/Alert.tsx`
- Modify: `src/components/ui/PageHeader.tsx`

**Interfaces:**
- Consumes: Task 1 토큰
- Produces: 기존과 **동일한 props 시그니처**. 호출부는 바꾸지 않는다.

- [ ] **Step 1: 현재 시그니처 확인**

Run: `npx tsc --noEmit` 전에 각 파일을 읽어 props 타입을 그대로 옮겨 적는다.

```bash
cat src/components/ui/TextField.tsx src/components/ui/Select.tsx src/components/ui/Checkbox.tsx src/components/ui/ToggleButton.tsx src/components/ui/Alert.tsx src/components/ui/PageHeader.tsx
```

Expected: 각 컴포넌트의 export 시그니처를 확인. **이 시그니처를 바꾸지 않는다.**

- [ ] **Step 2: 색상 클래스만 토큰으로 치환**

각 파일에서 아래 매핑대로 클래스만 바꾼다. 구조(JSX 트리), props, `aria-*`, `label` 연결은 건드리지 않는다.

| 기존 | 교체 |
|---|---|
| `border-slate-200` / `border-slate-100` | `border-border-subtle` |
| `border-slate-300` | `border-border-strong` |
| `bg-white` | `bg-surface-raised` |
| `bg-slate-50` / `bg-slate-100` | `bg-surface-base` |
| `text-slate-900` | `text-content-primary` |
| `text-slate-700` / `text-slate-600` | `text-content-secondary` |
| `text-slate-500` / `text-slate-400` | `text-content-muted` |
| `rounded-lg` (입력·버튼) | `rounded-tile` |
| `rounded-xl` (카드성 컨테이너) | `rounded-card` |
| `dark:border-slate-*` / `dark:bg-slate-*` / `dark:text-slate-*` | **삭제** (토큰이 이미 테마별로 바뀐다) |

- [ ] **Step 3: 타입 검사**

Run: `npm run typecheck`
Expected: 통과. 실패하면 시그니처를 바꾼 것이므로 되돌린다.

- [ ] **Step 4: 폼 관련 테스트 확인**

Run: `npx vitest run tests/unit/quick-entry-form.test.tsx tests/unit/edit-transaction-form.test.tsx tests/unit/planning-overview.test.tsx tests/unit/backup-restore.test.tsx tests/unit/delete-account.test.tsx tests/unit/admin-invite-settings.test.tsx`
Expected: PASS. 이 테스트들은 role/label 기반이라 클래스 변경에 영향받지 않아야 한다.

- [ ] **Step 5: 전체 스위트**

Run: `npm run test && npm run lint`
Expected: 통과

- [ ] **Step 6: 커밋**

```bash
git add src/components/ui
git commit -m "refactor: move form primitives onto semantic tokens"
```

---

## Task 4: SVG 시각화 프리미티브 (Sparkline, Ring)

**Files:**
- Create: `src/components/ui/Sparkline.tsx`
- Create: `src/components/ui/Ring.tsx`
- Test: `tests/unit/svg-primitives.test.tsx`

**Interfaces:**
- Consumes: Task 1 토큰
- Produces:
  - `Sparkline`: `({ values: readonly number[]; label: string; className?: string })` — `label`은 `aria-label`로 들어가는 텍스트 요약
  - `Ring`: `({ ratio: number; label: string; caption?: string; className?: string })` — `ratio`는 0..1, 범위를 벗어나면 클램프

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// tests/unit/svg-primitives.test.tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Ring } from "@/components/ui/Ring";
import { Sparkline } from "@/components/ui/Sparkline";

afterEach(cleanup);

describe("Sparkline", () => {
  it("exposes a text summary so the chart is not colour-only", () => {
    render(<Sparkline values={[1, 5, 3]} label="최근 3일 지출 추세" />);

    expect(screen.getByRole("img", { name: "최근 3일 지출 추세" })).toBeTruthy();
  });

  it("draws a polyline point per value", () => {
    const { container } = render(<Sparkline values={[10, 20, 30, 20]} label="추세" />);
    const points = container.querySelector("polyline")?.getAttribute("points") ?? "";

    expect(points.trim().split(/\s+/).length).toBe(4);
  });

  it("renders a flat line when every value is identical", () => {
    const { container } = render(<Sparkline values={[7, 7, 7]} label="추세" />);
    const points = (container.querySelector("polyline")?.getAttribute("points") ?? "")
      .trim()
      .split(/\s+/)
      .map((pair) => Number(pair.split(",")[1]));

    expect(new Set(points).size).toBe(1);
  });

  it("renders nothing but the label when there are no values", () => {
    const { container } = render(<Sparkline values={[]} label="추세" />);

    expect(container.querySelector("polyline")).toBeNull();
  });
});

describe("Ring", () => {
  it("shows the percentage as text next to the arc", () => {
    render(<Ring ratio={0.68} label="예산 사용률" />);

    expect(screen.getByText("68%")).toBeTruthy();
  });

  it("clamps a ratio above one", () => {
    render(<Ring ratio={1.4} label="예산 사용률" />);

    expect(screen.getByText("100%")).toBeTruthy();
  });

  it("clamps a negative ratio", () => {
    render(<Ring ratio={-0.2} label="예산 사용률" />);

    expect(screen.getByText("0%")).toBeTruthy();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/svg-primitives.test.tsx`
Expected: FAIL — `Cannot find module '@/components/ui/Sparkline'`

- [ ] **Step 3: `Sparkline.tsx` 작성**

```tsx
// src/components/ui/Sparkline.tsx
import { cx } from "@/components/ui/cx";

const WIDTH = 100;
const HEIGHT = 28;

// viewBox 좌표계로만 그리므로 부모 폭에 맞춰 늘어난다.
// 차트 라이브러리를 쓰지 않는 이유는 의존성 하나를 아끼기 위해서이고,
// 이 정도 표현에는 polyline 하나로 충분하다.
function toPoints(values: readonly number[]): string {
  if (values.length === 0) return "";
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min;
  const stepX = values.length === 1 ? 0 : WIDTH / (values.length - 1);

  return values
    .map((value, index) => {
      // 모든 값이 같으면 세로 중앙에 평평한 선을 그린다.
      const ratio = span === 0 ? 0.5 : (value - min) / span;
      const y = HEIGHT - ratio * HEIGHT;
      return `${(index * stepX).toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function Sparkline({
  values,
  label,
  className,
}: Readonly<{ values: readonly number[]; label: string; className?: string }>) {
  const points = toPoints(values);

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className={cx("h-7 w-full overflow-visible", className)}
    >
      {points ? (
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </svg>
  );
}
```

- [ ] **Step 4: `Ring.tsx` 작성**

```tsx
// src/components/ui/Ring.tsx
import { cx } from "@/components/ui/cx";

const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// UI_UX.md 10항: 차트는 숫자를 대신하지 않는다. 링 가운데에 항상 퍼센트를 쓴다.
export function Ring({
  ratio,
  label,
  caption,
  className,
}: Readonly<{ ratio: number; label: string; caption?: string; className?: string }>) {
  const safe = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  const percent = Math.round(safe * 100);

  return (
    <div className={cx("flex items-center gap-3", className)}>
      <svg viewBox="0 0 64 64" role="img" aria-label={`${label} ${percent}퍼센트`} className="h-16 w-16 shrink-0">
        <circle cx="32" cy="32" r={RADIUS} fill="none" stroke="currentColor" strokeWidth="6" className="text-border-subtle" />
        <circle
          cx="32"
          cy="32"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - safe)}
          transform="rotate(-90 32 32)"
          className="text-brand-500"
        />
      </svg>
      <div className="min-w-0">
        <p className="text-xs font-medium text-content-secondary">{label}</p>
        <p className="text-lg font-bold tabular-nums text-content-primary">{percent}%</p>
        {caption ? <p className="text-xs text-content-muted">{caption}</p> : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run tests/unit/svg-primitives.test.tsx`
Expected: PASS (7건)

- [ ] **Step 6: 커밋**

```bash
git add src/components/ui/Sparkline.tsx src/components/ui/Ring.tsx tests/unit/svg-primitives.test.tsx
git commit -m "feat: add dependency-free sparkline and progress ring"
```

---

## Task 5: 모션 래퍼 (FadeIn, Stagger, Pressable, PageTransition)

**Files:**
- Create: `src/components/motion/FadeIn.tsx`
- Create: `src/components/motion/Stagger.tsx`
- Create: `src/components/motion/Pressable.tsx`
- Create: `src/components/motion/PageTransition.tsx`
- Test: `tests/unit/motion-wrappers.test.tsx`

**Interfaces:**
- Consumes: `presets.ts`의 `fadeUp`, `springSoft`, `springSnappy`
- Produces:
  - `FadeIn`: `({ children: ReactNode; delay?: number; className?: string })`
  - `Stagger`: `({ children: ReactNode; className?: string; step?: number })` — 자식들을 순차 진입
  - `Pressable`: `({ children: ReactNode; className?: string })`
  - `PageTransition`: `({ children: ReactNode; routeKey: string; className?: string })`

- [ ] **Step 1: 실패하는 테스트 작성**

모션 값 자체가 아니라 **자식이 실제로 렌더되는지**를 검증한다. jsdom에서 애니메이션은 의미가 없고, 우리가 지켜야 할 계약은 "모션 래퍼가 콘텐츠를 삼키지 않는다"이다.

```tsx
// tests/unit/motion-wrappers.test.tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FadeIn } from "@/components/motion/FadeIn";
import { PageTransition } from "@/components/motion/PageTransition";
import { Pressable } from "@/components/motion/Pressable";
import { Stagger } from "@/components/motion/Stagger";

afterEach(cleanup);

describe("motion wrappers", () => {
  it("FadeIn renders its children", () => {
    render(<FadeIn>고유한-내용-fade</FadeIn>);

    expect(screen.getByText("고유한-내용-fade")).toBeTruthy();
  });

  it("Stagger renders every child", () => {
    render(
      <Stagger>
        <span>첫째</span>
        <span>둘째</span>
        <span>셋째</span>
      </Stagger>,
    );

    expect(screen.getByText("첫째")).toBeTruthy();
    expect(screen.getByText("둘째")).toBeTruthy();
    expect(screen.getByText("셋째")).toBeTruthy();
  });

  it("Pressable keeps the wrapped control reachable by role", () => {
    render(
      <Pressable>
        <button type="button">누르기</button>
      </Pressable>,
    );

    expect(screen.getByRole("button", { name: "누르기" })).toBeTruthy();
  });

  it("PageTransition renders its children", () => {
    render(<PageTransition routeKey="/home">고유한-내용-page</PageTransition>);

    expect(screen.getByText("고유한-내용-page")).toBeTruthy();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/motion-wrappers.test.tsx`
Expected: FAIL — `Cannot find module '@/components/motion/FadeIn'`

- [ ] **Step 3: `FadeIn.tsx` 작성**

```tsx
// src/components/motion/FadeIn.tsx
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
```

- [ ] **Step 4: `Stagger.tsx` 작성**

```tsx
// src/components/motion/Stagger.tsx
"use client";

import { motion } from "motion/react";
import { Children, type ReactNode } from "react";

import { fadeUp, springSoft } from "@/components/motion/presets";

// 진입 위계를 만들되 전체가 0.3초 안에 끝나도록 step 기본값을 작게 잡는다.
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
```

- [ ] **Step 5: `Pressable.tsx` 작성**

```tsx
// src/components/motion/Pressable.tsx
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
```

- [ ] **Step 6: `PageTransition.tsx` 작성**

```tsx
// src/components/motion/PageTransition.tsx
"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

import { DURATION_FAST } from "@/components/motion/presets";

// routeKey가 바뀌면 React가 이 div를 새로 마운트하므로 initial이 다시 실행된다.
// App Router의 서버 내비게이션과 맞물려도 동작하는 가장 단순한 방식이다.
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
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `npx vitest run tests/unit/motion-wrappers.test.tsx`
Expected: PASS (4건)

`motion/react`가 jsdom에서 로드되지 않는다면 `vitest.config.mts`의 `test.environment`가 `jsdom`인지 먼저 확인한다. 그래도 실패하면 에러 메시지를 그대로 보고하고 멈춘다 — 임의로 mock을 넣어 우회하지 않는다.

- [ ] **Step 8: 커밋**

```bash
git add src/components/motion tests/unit/motion-wrappers.test.tsx
git commit -m "feat: add motion wrappers isolated from server components"
```

---

## Task 6: Segmented와 Sheet

**Files:**
- Create: `src/components/ui/Segmented.tsx`
- Create: `src/components/ui/Sheet.tsx`
- Test: `tests/unit/segmented-sheet.test.tsx`

**Interfaces:**
- Consumes: `presets.ts`, Task 1 토큰
- Produces:
  - `Segmented`: `({ label: string; options: readonly { value: string; label: string }[]; value: string; onChange: (value: string) => void; className?: string })`
  - `Sheet`: `({ open: boolean; onClose: () => void; title: string; children: ReactNode })`

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// tests/unit/segmented-sheet.test.tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";

afterEach(cleanup);

const OPTIONS = [
  { value: "month", label: "월" },
  { value: "week", label: "주" },
];

describe("Segmented", () => {
  it("marks the selected option with aria-checked", () => {
    render(<Segmented label="보기 방식" options={OPTIONS} value="month" onChange={() => {}} />);

    expect(screen.getByRole("radio", { name: "월" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "주" }).getAttribute("aria-checked")).toBe("false");
  });

  it("reports the newly chosen value", () => {
    const onChange = vi.fn();
    render(<Segmented label="보기 방식" options={OPTIONS} value="month" onChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: "주" }));

    expect(onChange).toHaveBeenCalledWith("week");
  });

  it("names the group for assistive technology", () => {
    render(<Segmented label="보기 방식" options={OPTIONS} value="month" onChange={() => {}} />);

    expect(screen.getByRole("radiogroup", { name: "보기 방식" })).toBeTruthy();
  });
});

describe("Sheet", () => {
  it("renders nothing while closed", () => {
    render(
      <Sheet open={false} onClose={() => {}} title="8월 5일">
        <p>상세 내용</p>
      </Sheet>,
    );

    expect(screen.queryByText("상세 내용")).toBeNull();
  });

  it("renders a titled dialog while open", () => {
    render(
      <Sheet open onClose={() => {}} title="8월 5일">
        <p>상세 내용</p>
      </Sheet>,
    );

    expect(screen.getByRole("dialog", { name: "8월 5일" })).toBeTruthy();
    expect(screen.getByText("상세 내용")).toBeTruthy();
  });

  it("closes on the Escape key", () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="8월 5일">
        <p>상세 내용</p>
      </Sheet>,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });

  it("closes when the close button is pressed", () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="8월 5일">
        <p>상세 내용</p>
      </Sheet>,
    );

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/segmented-sheet.test.tsx`
Expected: FAIL — `Cannot find module '@/components/ui/Segmented'`

- [ ] **Step 3: `Segmented.tsx` 작성**

```tsx
// src/components/ui/Segmented.tsx
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
  // layoutId는 인스턴스마다 달라야 한다. 한 화면에 Segmented가 둘 이상 있으면
  // 같은 id를 공유해 인디케이터가 서로 날아다닌다.
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
```

`rounded-pill`은 아직 없다. `globals.css`의 `@theme inline` 블록에 `--radius-pill: 9999px;`를 추가한다.

- [ ] **Step 4: `Sheet.tsx` 작성**

```tsx
// src/components/ui/Sheet.tsx
"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { springSoft } from "@/components/motion/presets";

// 모바일에서는 아래에서 올라오는 바텀시트, 데스크톱에서는 오른쪽 사이드 패널.
// 두 형태 모두 같은 dialog 시맨틱을 쓴다.
export function Sheet({
  open,
  onClose,
  title,
  children,
}: Readonly<{ open: boolean; onClose: () => void; title: string; children: ReactNode }>) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreFocusTo.current = document.activeElement;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      // 포커스를 패널 안에 가둔다.
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (restoreFocusTo.current instanceof HTMLElement) restoreFocusTo.current.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-stretch sm:justify-end">
          <motion.button
            type="button"
            aria-label="배경 닫기"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={springSoft}
            className="glass-surface relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-card sm:max-h-none sm:w-96 sm:rounded-none sm:rounded-l-card"
          >
            <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <h2 id={titleId} className="text-base font-bold text-content-primary">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-3 py-1 text-sm font-semibold text-content-secondary hover:bg-surface-base"
              >
                닫기
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
```

- [ ] **Step 5: `--radius-pill` 토큰 추가**

`src/app/globals.css`의 `@theme inline` 블록 안, `--radius-tile` 아래에 추가한다.

```css
  --radius-pill: 9999px;
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run tests/unit/segmented-sheet.test.tsx`
Expected: PASS (7건)

- [ ] **Step 7: 타입 검사와 린트**

Run: `npm run typecheck && npm run lint`
Expected: 통과

- [ ] **Step 8: 커밋**

```bash
git add src/components/ui/Segmented.tsx src/components/ui/Sheet.tsx src/app/globals.css tests/unit/segmented-sheet.test.tsx
git commit -m "feat: add segmented control and accessible sheet"
```

---

## Task 7: 셸 재작성 (사이드바, 상단바, 하단탭)

**Files:**
- Modify: `src/components/nav/nav-items.ts`
- Modify: `src/components/nav/AppShell.tsx`
- Create: `src/components/nav/TopBar.tsx`
- Modify: `tests/unit/app-shell.test.tsx`

**Interfaces:**
- Consumes: `Surface`, `PageTransition`, `springSnappy`, Task 1 토큰
- Produces:
  - `nav-items.ts`: `sidebarNavItems`, `bottomNavItems`, `QUICK_ENTRY_HREF`, `isNavItemActive` (시그니처 유지) + `navLabelForPath(pathname: string): string`
  - `TopBar`: `({ title: string })`
  - `AppShell`: `({ children: ReactNode })` (시그니처 유지)

- [ ] **Step 1: `app-shell.test.tsx`에 새 계약을 추가**

기존 5건은 그대로 두고 아래 3건을 `describe` 안에 추가한다. **기존 단언을 삭제하지 않는다.**

```tsx
  it("exposes the calendar route in both navigations", () => {
    render(<AppShell>내용</AppShell>);

    const calendarLinks = screen.getAllByRole("link", { name: "달력" });
    expect(calendarLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of calendarLinks) {
      expect(link.getAttribute("href")).toBe("/calendar");
    }
  });

  it("shows the notification bell in the desktop top bar", () => {
    render(<AppShell>내용</AppShell>);

    expect(screen.getByRole("link", { name: "알림" }).getAttribute("href")).toBe("/notifications");
  });

  it("titles the top bar with the current route", () => {
    render(<AppShell>내용</AppShell>);

    expect(screen.getByRole("heading", { name: "거래내역" })).toBeTruthy();
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/app-shell.test.tsx`
Expected: FAIL — `Unable to find an accessible element with the role "link" and name "달력"`

- [ ] **Step 3: `nav-items.ts` 갱신**

```ts
// src/components/nav/nav-items.ts
export type NavItem = Readonly<{ href: string; label: string }>;

export const sidebarNavItems: readonly NavItem[] = [
  { href: "/home", label: "홈" },
  { href: "/transactions", label: "거래내역" },
  { href: "/calendar", label: "달력" },
  { href: "/assets", label: "자산" },
  { href: "/plans", label: "계획" },
  { href: "/statistics", label: "통계" },
  { href: "/export", label: "AI Export" },
  { href: "/settings", label: "설정" },
];

// 모바일에서는 회고(달력)가 계획보다 사용 빈도가 높다.
// 계획은 `더보기`에서 계속 접근할 수 있다.
export const bottomNavItems: readonly NavItem[] = [
  { href: "/home", label: "홈" },
  { href: "/transactions", label: "내역" },
  { href: "/transactions/new", label: "입력" },
  { href: "/calendar", label: "달력" },
  { href: "/more", label: "더보기" },
];

export const QUICK_ENTRY_HREF = "/transactions/new";

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/home") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const EXTRA_TITLES: readonly NavItem[] = [
  { href: "/notifications", label: "알림" },
  { href: "/more", label: "더보기" },
  { href: "/onboarding", label: "시작 설정" },
];

// 상단바 제목. 가장 긴 일치 항목을 고른다 (/transactions/new 가 /transactions 보다 우선).
export function navLabelForPath(pathname: string): string {
  const candidates = [...sidebarNavItems, ...EXTRA_TITLES, { href: "/transactions/new", label: "거래 입력" }];
  let best: NavItem | undefined;
  for (const item of candidates) {
    if (!isNavItemActive(pathname, item.href)) continue;
    if (!best || item.href.length > best.href.length) best = item;
  }
  return best?.label ?? "Money Context";
}
```

- [ ] **Step 4: `TopBar.tsx` 작성**

```tsx
// src/components/nav/TopBar.tsx
"use client";

import Link from "next/link";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Surface } from "@/components/ui/Surface";

export function TopBar({ title }: Readonly<{ title: string }>) {
  return (
    <Surface className="sticky top-0 z-30 flex items-center justify-between border-b border-border-subtle px-4 py-3 sm:px-6 lg:px-8">
      <h1 className="truncate text-lg font-bold tracking-tight text-content-primary">{title}</h1>
      <div className="flex items-center gap-1">
        <Link
          href="/notifications"
          aria-label="알림"
          className="rounded-full p-2 text-content-secondary hover:bg-surface-base"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5 fill-current">
            <path d="M10 2a5 5 0 0 0-5 5v3.6L3.6 13a.8.8 0 0 0 .7 1.2h11.4a.8.8 0 0 0 .7-1.2L15 10.6V7a5 5 0 0 0-5-5Zm0 15a2.2 2.2 0 0 0 2.1-1.6H7.9A2.2 2.2 0 0 0 10 17Z" />
          </svg>
        </Link>
        <ThemeToggle />
      </div>
    </Surface>
  );
}
```

- [ ] **Step 5: `AppShell.tsx` 재작성**

```tsx
// src/components/nav/AppShell.tsx
"use client";

import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { PageTransition } from "@/components/motion/PageTransition";
import { springSnappy } from "@/components/motion/presets";
import { TopBar } from "@/components/nav/TopBar";
import {
  QUICK_ENTRY_HREF,
  bottomNavItems,
  isNavItemActive,
  navLabelForPath,
  sidebarNavItems,
} from "@/components/nav/nav-items";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Surface } from "@/components/ui/Surface";
import { cx } from "@/components/ui/cx";

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-surface-base">
      <a
        className="fixed -left-[999px] -top-[999px] z-100 rounded-tile bg-surface-raised px-4 py-2 font-medium text-brand-700 shadow-lifted focus:left-4 focus:top-4 dark:text-brand-300"
        href="#main-content"
      >
        메인 콘텐츠로 건너뛰기
      </a>

      <nav
        className="hidden w-60 shrink-0 border-r border-border-subtle bg-surface-raised p-3 md:flex md:flex-col dark:bg-surface-base"
        aria-label="주 메뉴"
      >
        <div className="mb-6 flex items-center gap-2 px-2 pt-2">
          <Image src="/logo.png" alt="" width={28} height={28} className="rounded-tile" />
          <span className="text-base font-bold tracking-tight text-content-primary">Money Context</span>
        </div>
        <ul className="flex flex-1 list-none flex-col gap-0.5 p-0">
          {sidebarNavItems.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "relative block rounded-tile px-3 py-2 text-sm font-semibold no-underline transition-colors",
                    active ? "text-brand-700 dark:text-brand-300" : "text-content-secondary hover:text-content-primary",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="sidebar-active-pill"
                      transition={springSnappy}
                      className="absolute inset-0 rounded-tile bg-brand-500/12"
                    />
                  ) : null}
                  <span className="relative">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between border-t border-border-subtle px-2 pt-3">
          <span className="text-xs text-content-muted">화면 모드</span>
          <ThemeToggle />
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="hidden md:block">
          <TopBar title={navLabelForPath(pathname)} />
        </div>

        <main id="main-content" className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-10 lg:px-8" tabIndex={-1}>
          <PageTransition routeKey={pathname} className="mx-auto w-full max-w-5xl">
            {children}
          </PageTransition>
        </main>
      </div>

      <Surface
        as-nav="true"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle md:hidden"
      >
        <nav aria-label="하단 메뉴">
          <ul className="flex list-none items-end justify-around p-0 pb-1">
            {bottomNavItems.map((item) => {
              const active = isNavItemActive(pathname, item.href);
              const isPrimary = item.href === QUICK_ENTRY_HREF;

              if (isPrimary) {
                return (
                  <li key={item.href} className="flex-1">
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className="mx-auto -mt-5 flex h-12 w-12 flex-col items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-500 text-xs font-bold text-white no-underline shadow-lifted"
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              }

              return (
                <li key={item.href} className="flex-1">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "flex flex-col items-center gap-1 py-2.5 text-xs no-underline transition-colors",
                      active ? "font-bold text-brand-600 dark:text-brand-400" : "text-content-muted",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </Surface>
    </div>
  );
}
```

`Surface`는 `HTMLAttributes<HTMLDivElement>`를 받으므로 `as-nav` 같은 임의 속성은 넘기지 않는다. 위 코드에서 `as-nav="true"` 줄은 **삭제하고** `<Surface className="...">`만 남긴다.

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run tests/unit/app-shell.test.tsx`
Expected: PASS (8건)

`"입력"` 링크 테스트는 FAB로 바뀌어도 `<Link>` role="link" name="입력"이 유지되므로 통과해야 한다.

- [ ] **Step 7: 타입 검사와 린트**

Run: `npm run typecheck && npm run lint`
Expected: 통과

- [ ] **Step 8: 커밋**

```bash
git add src/components/nav tests/unit/app-shell.test.tsx
git commit -m "feat: redesign app shell with top bar and calendar nav"
```

---

## Task 8: Asia/Seoul 날짜 헬퍼 공유화

**Files:**
- Create: `src/lib/dates/seoul.ts`
- Modify: `src/server/notifications/repository.ts`
- Test: `tests/unit/seoul-date.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `toSeoulDate(isoTimestamp: string): string` — timestamptz → `YYYY-MM-DD` (Asia/Seoul)
  - `seoulDayStartUtcIso(date: string): string` — `YYYY-MM-DD` → 그 날 Seoul 00:00의 UTC ISO 문자열
  - `addIsoDays(date: string, days: number): string` — `YYYY-MM-DD` 덧셈
  - `todayInSeoul(now?: Date): string`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/unit/seoul-date.test.ts
import { describe, expect, it } from "vitest";

import { addIsoDays, seoulDayStartUtcIso, todayInSeoul, toSeoulDate } from "@/lib/dates/seoul";

describe("toSeoulDate", () => {
  it("keeps a mid-day UTC timestamp on the same Seoul day", () => {
    expect(toSeoulDate("2026-08-05T03:00:00Z")).toBe("2026-08-05");
  });

  it("rolls a late-evening UTC timestamp into the next Seoul day", () => {
    // 한국은 UTC+9라 UTC 15:30은 이미 다음 날 00:30이다.
    expect(toSeoulDate("2026-08-05T15:30:00Z")).toBe("2026-08-06");
  });

  it("keeps an early-morning UTC timestamp on the same Seoul day", () => {
    // UTC 00:30은 한국 09:30. 날짜가 밀리면 안 된다.
    expect(toSeoulDate("2026-08-05T00:30:00Z")).toBe("2026-08-05");
  });

  it("handles a month boundary", () => {
    expect(toSeoulDate("2026-07-31T15:00:00Z")).toBe("2026-08-01");
  });

  it("handles a year boundary", () => {
    expect(toSeoulDate("2026-12-31T15:00:00Z")).toBe("2027-01-01");
  });
});

describe("seoulDayStartUtcIso", () => {
  it("maps Seoul midnight to 15:00 UTC on the previous day", () => {
    expect(seoulDayStartUtcIso("2026-08-05")).toBe("2026-08-04T15:00:00.000Z");
  });

  it("rejects a malformed date", () => {
    expect(() => seoulDayStartUtcIso("2026-8-5")).toThrow(RangeError);
  });
});

describe("addIsoDays", () => {
  it("adds days across a month boundary", () => {
    expect(addIsoDays("2026-08-30", 3)).toBe("2026-09-02");
  });

  it("subtracts days across a year boundary", () => {
    expect(addIsoDays("2026-01-02", -3)).toBe("2025-12-30");
  });

  it("handles a leap day", () => {
    expect(addIsoDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("todayInSeoul", () => {
  it("derives the Seoul date from the supplied instant", () => {
    expect(todayInSeoul(new Date("2026-08-05T15:30:00Z"))).toBe("2026-08-06");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/seoul-date.test.ts`
Expected: FAIL — `Cannot find module '@/lib/dates/seoul'`

- [ ] **Step 3: `seoul.ts` 작성**

```ts
// src/lib/dates/seoul.ts
// 앱 전체가 Asia/Seoul을 기준 시간대로 쓴다 (AGENTS.md 3항).
// timestamptz를 slice(0, 10)으로 자르면 UTC 기준이 되어
// 한국 시간 오전 9시 이전 거래가 전날로 밀린다. 이 모듈을 대신 쓴다.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SEOUL_UTC_OFFSET_HOURS = 9;

const SEOUL_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function toSeoulDate(isoTimestamp: string): string {
  const instant = new Date(isoTimestamp);
  if (Number.isNaN(instant.getTime())) throw new RangeError("timestamp must be parseable");
  // en-CA는 YYYY-MM-DD 형식을 그대로 내준다.
  return SEOUL_FORMATTER.format(instant);
}

export function todayInSeoul(now: Date = new Date()): string {
  return SEOUL_FORMATTER.format(now);
}

export function assertIsoDate(value: string): [number, number, number] {
  if (!ISO_DATE.test(value)) throw new RangeError("date must be YYYY-MM-DD");
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const probe = new Date(0);
  probe.setUTCFullYear(year, month - 1, day);
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new RangeError("date must be a valid YYYY-MM-DD date");
  }
  return [year, month, day];
}

export function seoulDayStartUtcIso(date: string): string {
  const [year, month, day] = assertIsoDate(date);
  return new Date(Date.UTC(year, month - 1, day, -SEOUL_UTC_OFFSET_HOURS)).toISOString();
}

export function addIsoDays(date: string, days: number): string {
  const [year, month, day] = assertIsoDate(date);
  const shifted = new Date(Date.UTC(year, month - 1, day));
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/unit/seoul-date.test.ts`
Expected: PASS (11건)

- [ ] **Step 5: 알림 리포지토리가 공유 함수를 쓰도록 수정**

`src/server/notifications/repository.ts`에서:

1. 파일 상단 import에 추가: `import { toSeoulDate } from "@/lib/dates/seoul";`
2. 비공개 `seoulDate` 함수 정의(54–63행)를 **삭제**한다.
3. 이 파일 안의 `seoulDate(` 호출을 전부 `toSeoulDate(`로 바꾼다.

`assertIsoDate`, `addDays`, `seoulDayStart`, `cardDueDates`는 그대로 둔다. 이 태스크의 목적은 중복된 `seoulDate` 하나를 없애는 것이지 알림 모듈을 리팩터링하는 것이 아니다.

- [ ] **Step 6: 알림 테스트로 회귀 확인**

Run: `npx vitest run tests/integration/notifications.test.ts tests/unit/notification-service.test.ts tests/unit/notification-rules.test.ts`
Expected: PASS

- [ ] **Step 7: 전체 게이트**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: 통과

- [ ] **Step 8: 커밋**

```bash
git add src/lib/dates/seoul.ts src/server/notifications/repository.ts tests/unit/seoul-date.test.ts
git commit -m "refactor: share the Asia/Seoul date helper"
```

---

## Task 9: 달력 도메인 — 타입과 월 그리드

**Files:**
- Create: `src/domain/calendar/types.ts`
- Create: `src/domain/calendar/month.ts`
- Test: `tests/unit/calendar-month.test.ts`

**Interfaces:**
- Consumes: `@/lib/dates/seoul`의 `toSeoulDate`, `assertIsoDate`, `addIsoDays`
- Produces:
  - `types.ts`: `CalendarTransaction`, `UpcomingMarker`, `UpcomingKind`, `CalendarCell`, `CalendarMonth`, `HeatLevel`
  - `month.ts`: `buildMonthGrid`, `aggregateDailyTotals`, `heatLevels`, `parseYearMonth`, `buildCalendarMonth`, `gridRange`

- [ ] **Step 1: `types.ts` 작성**

먼저 타입을 확정한다. 이후 태스크가 전부 이 이름을 참조한다.

```ts
// src/domain/calendar/types.ts
export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export type CalendarTransaction = Readonly<{
  id: string;
  type: "INCOME" | "EXPENSE";
  baseAmount: number;
  memo?: string;
  categoryName?: string;
  accountName?: string;
}>;

export type UpcomingKind = "PLANNED" | "CARD_PAYMENT" | "RECURRING";

export type UpcomingMarker = Readonly<{
  kind: UpcomingKind;
  label: string;
  /** 표시 전용. summary와 cell.income/expense에는 절대 합산하지 않는다 (재정 규칙 7). */
  amount?: number;
  direction: "INCOME" | "EXPENSE";
}>;

export type CalendarCell = Readonly<{
  date: string;
  inCurrentMonth: boolean;
  isToday: boolean;
  /** 0=일 .. 6=토 */
  weekday: number;
  income: number;
  expense: number;
  heatLevel: HeatLevel;
  transactions: readonly CalendarTransaction[];
  upcoming: readonly UpcomingMarker[];
}>;

export type CalendarMonth = Readonly<{
  year: number;
  month: number;
  /** 항상 42칸(6주). */
  cells: readonly CalendarCell[];
  summary: Readonly<{ income: number; expense: number; net: number }>;
}>;

/** 홈의 최근 14일 히트 스트립 한 칸. Task 14의 대시보드와 CalendarStrip이 공유한다. */
export type DashboardDay = Readonly<{
  date: string;
  income: number;
  expense: number;
  heatLevel: HeatLevel;
}>;
```

- [ ] **Step 2: 실패하는 테스트 작성**

```ts
// tests/unit/calendar-month.test.ts
import { describe, expect, it } from "vitest";

import {
  aggregateDailyTotals,
  buildCalendarMonth,
  buildMonthGrid,
  gridRange,
  heatLevels,
  parseYearMonth,
} from "@/domain/calendar/month";

const NO_UPCOMING = new Map();

describe("buildMonthGrid", () => {
  it("always returns 42 cells", () => {
    expect(buildMonthGrid(2026, 8, "2026-08-12")).toHaveLength(42);
    expect(buildMonthGrid(2026, 2, "2026-08-12")).toHaveLength(42);
  });

  it("starts on the Sunday on or before the first of the month", () => {
    // 2026-08-01은 토요일이므로 그리드는 7월 26일 일요일에서 시작한다.
    expect(buildMonthGrid(2026, 8, "2026-08-12")[0].date).toBe("2026-07-26");
  });

  it("starts on the first when the month opens on a Sunday", () => {
    // 2026-11-01은 일요일이다.
    expect(buildMonthGrid(2026, 11, "2026-11-05")[0].date).toBe("2026-11-01");
  });

  it("flags neighbour-month days as outside the current month", () => {
    const grid = buildMonthGrid(2026, 8, "2026-08-12");

    expect(grid[0].inCurrentMonth).toBe(false);
    expect(grid.find((cell) => cell.date === "2026-08-01")?.inCurrentMonth).toBe(true);
    expect(grid.find((cell) => cell.date === "2026-08-31")?.inCurrentMonth).toBe(true);
    expect(grid[41].inCurrentMonth).toBe(false);
  });

  it("covers every day of a 29-day February", () => {
    const grid = buildMonthGrid(2028, 2, "2028-02-10");

    expect(grid.some((cell) => cell.date === "2028-02-29")).toBe(true);
    expect(grid.some((cell) => cell.date === "2028-03-01")).toBe(true);
  });

  it("crosses the December to January boundary", () => {
    const grid = buildMonthGrid(2026, 12, "2026-12-10");

    expect(grid.some((cell) => cell.date === "2026-12-31")).toBe(true);
    expect(grid.some((cell) => cell.date.startsWith("2027-01"))).toBe(true);
  });

  it("marks today", () => {
    const grid = buildMonthGrid(2026, 8, "2026-08-12");

    expect(grid.filter((cell) => cell.isToday)).toHaveLength(1);
    expect(grid.find((cell) => cell.isToday)?.date).toBe("2026-08-12");
  });

  it("assigns Sunday to weekday 0 and Saturday to weekday 6", () => {
    const grid = buildMonthGrid(2026, 8, "2026-08-12");

    expect(grid[0].weekday).toBe(0);
    expect(grid[6].weekday).toBe(6);
  });
});

describe("gridRange", () => {
  it("reports the first and last date of the 42-cell grid", () => {
    expect(gridRange(2026, 8)).toEqual({ start: "2026-07-26", end: "2026-09-05" });
  });
});

describe("aggregateDailyTotals", () => {
  const base = { currency: "KRW", memo: undefined, categoryName: undefined, accountName: undefined };

  it("sums income and expense per Seoul day", () => {
    const totals = aggregateDailyTotals([
      { ...base, id: "1", type: "EXPENSE", status: "CONFIRMED", transactionAt: "2026-08-05T03:00:00Z", baseAmount: 12_000 },
      { ...base, id: "2", type: "EXPENSE", status: "CONFIRMED", transactionAt: "2026-08-05T05:00:00Z", baseAmount: 8_000 },
      { ...base, id: "3", type: "INCOME", status: "CONFIRMED", transactionAt: "2026-08-05T06:00:00Z", baseAmount: 2_500_000 },
    ]);

    expect(totals.get("2026-08-05")).toEqual({ income: 2_500_000, expense: 20_000 });
  });

  it("excludes transfers because a transfer is neither income nor expense", () => {
    const totals = aggregateDailyTotals([
      { ...base, id: "1", type: "TRANSFER", status: "CONFIRMED", transactionAt: "2026-08-05T03:00:00Z", baseAmount: 500_000 },
    ]);

    expect(totals.get("2026-08-05")).toBeUndefined();
  });

  it("excludes balance adjustments from income and expense", () => {
    const totals = aggregateDailyTotals([
      { ...base, id: "1", type: "ADJUSTMENT", status: "CONFIRMED", transactionAt: "2026-08-05T03:00:00Z", baseAmount: 30_000 },
    ]);

    expect(totals.get("2026-08-05")).toBeUndefined();
  });

  it("excludes pending and cancelled transactions", () => {
    const totals = aggregateDailyTotals([
      { ...base, id: "1", type: "EXPENSE", status: "PENDING", transactionAt: "2026-08-05T03:00:00Z", baseAmount: 10_000 },
      { ...base, id: "2", type: "EXPENSE", status: "CANCELLED", transactionAt: "2026-08-05T03:00:00Z", baseAmount: 10_000 },
    ]);

    expect(totals.get("2026-08-05")).toBeUndefined();
  });

  it("uses baseAmount so a foreign-currency purchase counts in KRW", () => {
    const totals = aggregateDailyTotals([
      { ...base, id: "1", type: "EXPENSE", status: "CONFIRMED", currency: "USD", transactionAt: "2026-08-05T03:00:00Z", baseAmount: 137_000 },
    ]);

    expect(totals.get("2026-08-05")?.expense).toBe(137_000);
  });

  it("assigns a late-UTC transaction to the next Seoul day", () => {
    const totals = aggregateDailyTotals([
      { ...base, id: "1", type: "EXPENSE", status: "CONFIRMED", transactionAt: "2026-08-05T15:30:00Z", baseAmount: 9_000 },
    ]);

    expect(totals.get("2026-08-05")).toBeUndefined();
    expect(totals.get("2026-08-06")?.expense).toBe(9_000);
  });
});

describe("heatLevels", () => {
  it("keeps ordinary days above level 0 even when one outlier dwarfs them", () => {
    const levels = heatLevels(
      new Map([
        ["d1", 10_000],
        ["d2", 20_000],
        ["d3", 30_000],
        ["d4", 40_000],
        ["d5", 2_000_000],
      ]),
    );

    // 최댓값 선형 스케일이었다면 d1~d4가 전부 0단계로 붕괴한다.
    for (const key of ["d1", "d2", "d3", "d4"]) {
      expect(levels.get(key)).toBeGreaterThan(0);
    }
    expect(levels.get("d5")).toBe(4);
  });

  it("gives a zero-spend day level 0", () => {
    const levels = heatLevels(new Map([["d1", 0], ["d2", 50_000]]));

    expect(levels.get("d1")).toBe(0);
  });

  it("returns level 0 everywhere when nothing was spent", () => {
    const levels = heatLevels(new Map([["d1", 0], ["d2", 0]]));

    expect(levels.get("d1")).toBe(0);
    expect(levels.get("d2")).toBe(0);
  });

  it("gives a single spending day the top level", () => {
    expect(heatLevels(new Map([["d1", 5_000]])).get("d1")).toBe(4);
  });
});

describe("parseYearMonth", () => {
  it("reads a well-formed value", () => {
    expect(parseYearMonth("2026-08", "2026-11-20")).toEqual({ year: 2026, month: 8 });
  });

  it("falls back to the reference month when the value is missing", () => {
    expect(parseYearMonth(undefined, "2026-11-20")).toEqual({ year: 2026, month: 11 });
  });

  it("falls back when the month is out of range", () => {
    expect(parseYearMonth("2026-13", "2026-11-20")).toEqual({ year: 2026, month: 11 });
  });

  it("falls back on a malformed value", () => {
    expect(parseYearMonth("아무거나", "2026-11-20")).toEqual({ year: 2026, month: 11 });
  });
});

describe("buildCalendarMonth", () => {
  const transactions = [
    { id: "1", type: "EXPENSE" as const, status: "CONFIRMED" as const, transactionAt: "2026-08-05T03:00:00Z", baseAmount: 47_000, memo: "점심", categoryName: "식비", accountName: "국민카드" },
    { id: "2", type: "INCOME" as const, status: "CONFIRMED" as const, transactionAt: "2026-08-25T01:00:00Z", baseAmount: 2_500_000, memo: "급여", categoryName: "급여", accountName: "주거래" },
    { id: "3", type: "TRANSFER" as const, status: "CONFIRMED" as const, transactionAt: "2026-08-10T01:00:00Z", baseAmount: 300_000 },
  ];

  it("summarises only the current month, excluding transfers", () => {
    const month = buildCalendarMonth({ year: 2026, month: 8, today: "2026-08-12", transactions, upcoming: NO_UPCOMING });

    expect(month.summary).toEqual({ income: 2_500_000, expense: 47_000, net: 2_453_000 });
  });

  it("attaches transactions to their own cell", () => {
    const month = buildCalendarMonth({ year: 2026, month: 8, today: "2026-08-12", transactions, upcoming: NO_UPCOMING });
    const cell = month.cells.find((item) => item.date === "2026-08-05");

    expect(cell?.expense).toBe(47_000);
    expect(cell?.transactions.map((item) => item.memo)).toEqual(["점심"]);
  });

  it("leaves transfer-only days empty", () => {
    const month = buildCalendarMonth({ year: 2026, month: 8, today: "2026-08-12", transactions, upcoming: NO_UPCOMING });
    const cell = month.cells.find((item) => item.date === "2026-08-10");

    expect(cell?.income).toBe(0);
    expect(cell?.expense).toBe(0);
    expect(cell?.transactions).toHaveLength(0);
  });

  it("keeps upcoming markers out of the totals", () => {
    const upcoming = new Map([
      ["2026-08-12", [{ kind: "PLANNED" as const, label: "예정 지출", amount: 30_000, direction: "EXPENSE" as const }]],
    ]);
    const month = buildCalendarMonth({ year: 2026, month: 8, today: "2026-08-12", transactions, upcoming });
    const cell = month.cells.find((item) => item.date === "2026-08-12");

    expect(cell?.upcoming).toHaveLength(1);
    expect(cell?.expense).toBe(0);
    expect(month.summary.expense).toBe(47_000);
  });

  it("excludes neighbour-month days from the summary", () => {
    const withNeighbour = [
      ...transactions,
      { id: "4", type: "EXPENSE" as const, status: "CONFIRMED" as const, transactionAt: "2026-07-28T03:00:00Z", baseAmount: 99_000 },
    ];
    const month = buildCalendarMonth({ year: 2026, month: 8, today: "2026-08-12", transactions: withNeighbour, upcoming: NO_UPCOMING });

    // 7월 28일은 그리드에는 보이지만 8월 합계에는 들어가지 않는다.
    expect(month.cells.find((item) => item.date === "2026-07-28")?.expense).toBe(99_000);
    expect(month.summary.expense).toBe(47_000);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run tests/unit/calendar-month.test.ts`
Expected: FAIL — `Cannot find module '@/domain/calendar/month'`

- [ ] **Step 4: `month.ts` 작성**

```ts
// src/domain/calendar/month.ts
import { assertIsoDate, toSeoulDate } from "@/lib/dates/seoul";

import type { CalendarCell, CalendarMonth, CalendarTransaction, HeatLevel, UpcomingMarker } from "./types";

const GRID_CELLS = 42;

export type CalendarDay = Readonly<{ date: string; inCurrentMonth: boolean; isToday: boolean; weekday: number }>;

export type SourceTransaction = Readonly<{
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT";
  status: "CONFIRMED" | "PENDING" | "CANCELLED";
  transactionAt: string;
  baseAmount: number;
  memo?: string;
  categoryName?: string;
  accountName?: string;
}>;

export type DailyTotals = Readonly<{ income: number; expense: number }>;

/** 달력에 실제로 합산되는 거래인지. 재정 규칙 1(이체)·6(잔액조정)·7(미확정)을 한 곳에서 지킨다. */
function countsTowardTotals(transaction: SourceTransaction): boolean {
  if (transaction.status !== "CONFIRMED") return false;
  return transaction.type === "INCOME" || transaction.type === "EXPENSE";
}

export function buildMonthGrid(year: number, month: number, today: string): readonly CalendarDay[] {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const leadingDays = firstOfMonth.getUTCDay();
  const gridStart = new Date(Date.UTC(year, month - 1, 1 - leadingDays));

  return Array.from({ length: GRID_CELLS }, (_, index) => {
    const cursor = new Date(gridStart);
    cursor.setUTCDate(gridStart.getUTCDate() + index);
    const date = cursor.toISOString().slice(0, 10);
    return {
      date,
      inCurrentMonth: cursor.getUTCFullYear() === year && cursor.getUTCMonth() === month - 1,
      isToday: date === today,
      weekday: cursor.getUTCDay(),
    };
  });
}

export function gridRange(year: number, month: number): Readonly<{ start: string; end: string }> {
  const grid = buildMonthGrid(year, month, "");
  return { start: grid[0].date, end: grid[GRID_CELLS - 1].date };
}

export function aggregateDailyTotals(
  transactions: readonly SourceTransaction[],
): ReadonlyMap<string, DailyTotals> {
  const totals = new Map<string, { income: number; expense: number }>();

  for (const transaction of transactions) {
    if (!countsTowardTotals(transaction)) continue;
    const date = toSeoulDate(transaction.transactionAt);
    const bucket = totals.get(date) ?? { income: 0, expense: 0 };
    if (transaction.type === "INCOME") bucket.income += transaction.baseAmount;
    else bucket.expense += transaction.baseAmount;
    totals.set(date, bucket);
  }

  return totals;
}

/**
 * 지출 강도를 4단계로 나눈다.
 * 최댓값 대비 선형 스케일을 쓰면 급여일 같은 이상치 하나에 나머지 날이 전부
 * 0단계로 눌리므로, 지출이 있는 날들의 분위수를 기준으로 삼는다.
 */
export function heatLevels(expenseByDate: ReadonlyMap<string, number>): ReadonlyMap<string, HeatLevel> {
  const levels = new Map<string, HeatLevel>();
  const spending = [...expenseByDate.values()].filter((value) => value > 0).sort((a, b) => a - b);

  if (spending.length === 0) {
    for (const date of expenseByDate.keys()) levels.set(date, 0);
    return levels;
  }

  const quantile = (fraction: number) => spending[Math.min(spending.length - 1, Math.floor(fraction * spending.length))];
  const [q1, q2, q3] = [quantile(0.25), quantile(0.5), quantile(0.75)];

  for (const [date, value] of expenseByDate) {
    if (value <= 0) levels.set(date, 0);
    else if (value <= q1) levels.set(date, 1);
    else if (value <= q2) levels.set(date, 2);
    else if (value <= q3) levels.set(date, 3);
    else levels.set(date, 4);
  }

  return levels;
}

const YEAR_MONTH = /^(\d{4})-(\d{2})$/;

export function parseYearMonth(
  value: string | undefined,
  referenceDate: string,
): Readonly<{ year: number; month: number }> {
  const match = value ? YEAR_MONTH.exec(value) : null;
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) return { year, month };
  }
  const [year, month] = assertIsoDate(referenceDate);
  return { year, month };
}

export function buildCalendarMonth(
  input: Readonly<{
    year: number;
    month: number;
    today: string;
    transactions: readonly SourceTransaction[];
    upcoming: ReadonlyMap<string, readonly UpcomingMarker[]>;
  }>,
): CalendarMonth {
  const grid = buildMonthGrid(input.year, input.month, input.today);
  const totals = aggregateDailyTotals(input.transactions);
  const levels = heatLevels(new Map([...totals].map(([date, value]) => [date, value.expense])));

  const byDate = new Map<string, CalendarTransaction[]>();
  for (const transaction of input.transactions) {
    if (!countsTowardTotals(transaction)) continue;
    const date = toSeoulDate(transaction.transactionAt);
    const bucket = byDate.get(date) ?? [];
    bucket.push({
      id: transaction.id,
      type: transaction.type === "INCOME" ? "INCOME" : "EXPENSE",
      baseAmount: transaction.baseAmount,
      memo: transaction.memo,
      categoryName: transaction.categoryName,
      accountName: transaction.accountName,
    });
    byDate.set(date, bucket);
  }

  const cells: CalendarCell[] = grid.map((day) => {
    const dayTotals = totals.get(day.date) ?? { income: 0, expense: 0 };
    return {
      ...day,
      income: dayTotals.income,
      expense: dayTotals.expense,
      heatLevel: levels.get(day.date) ?? 0,
      transactions: byDate.get(day.date) ?? [],
      upcoming: input.upcoming.get(day.date) ?? [],
    };
  });

  // 합계는 이번 달 칸만 센다. 그리드에 걸친 이웃 달 날짜는 표시만 하고 제외한다.
  let income = 0;
  let expense = 0;
  for (const cell of cells) {
    if (!cell.inCurrentMonth) continue;
    income += cell.income;
    expense += cell.expense;
  }

  return {
    year: input.year,
    month: input.month,
    cells,
    summary: { income, expense, net: income - expense },
  };
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run tests/unit/calendar-month.test.ts`
Expected: PASS (26건)

- [ ] **Step 6: 타입 검사**

Run: `npm run typecheck && npm run lint`
Expected: 통과

- [ ] **Step 7: 커밋**

```bash
git add src/domain/calendar tests/unit/calendar-month.test.ts
git commit -m "feat: add calendar month grid and daily aggregation"
```

---

## Task 10: 달력 도메인 — 예정 마커

**Files:**
- Create: `src/domain/calendar/upcoming.ts`
- Test: `tests/unit/calendar-upcoming.test.ts`

**Interfaces:**
- Consumes: `@/domain/recurring/schedule`의 `nextOccurrenceDate`, `@/domain/calendar/types`의 `UpcomingMarker`
- Produces: `collectUpcomingMarkers(input: UpcomingInput): ReadonlyMap<string, readonly UpcomingMarker[]>`, 타입 `UpcomingInput`, `UpcomingPlanned`, `UpcomingCard`, `UpcomingRecurringRule`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/unit/calendar-upcoming.test.ts
import { describe, expect, it } from "vitest";

import { collectUpcomingMarkers } from "@/domain/calendar/upcoming";

const EMPTY = { planned: [], cards: [], recurringRules: [], confirmedRecurringDates: [] };

describe("collectUpcomingMarkers", () => {
  it("marks a planned transaction on its scheduled date", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "2026-08-01",
      rangeEnd: "2026-08-31",
      planned: [{ scheduledDate: "2026-08-12", type: "EXPENSE", amount: 30_000, baseAmount: 30_000, memo: "치과" }],
    });

    expect(markers.get("2026-08-12")).toEqual([
      { kind: "PLANNED", label: "치과", amount: 30_000, direction: "EXPENSE" },
    ]);
  });

  it("labels a planned transaction without a memo", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "2026-08-01",
      rangeEnd: "2026-08-31",
      planned: [{ scheduledDate: "2026-08-12", type: "INCOME", amount: 50_000, baseAmount: 50_000 }],
    });

    expect(markers.get("2026-08-12")?.[0].label).toBe("예정 수입");
  });

  it("ignores a planned transaction outside the range", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "2026-08-01",
      rangeEnd: "2026-08-31",
      planned: [{ scheduledDate: "2026-09-12", type: "EXPENSE", amount: 30_000, baseAmount: 30_000 }],
    });

    expect(markers.size).toBe(0);
  });

  it("marks a card payment day in every month the range covers", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "2026-07-26",
      rangeEnd: "2026-09-05",
      cards: [{ accountId: "card-1", accountName: "국민카드", paymentDay: 25 }],
    });

    expect(markers.get("2026-07-25")).toBeUndefined();
    expect(markers.get("2026-08-25")?.[0]).toEqual({
      kind: "CARD_PAYMENT",
      label: "국민카드 결제",
      direction: "EXPENSE",
    });
  });

  it("clamps a 31st payment day to the last day of February", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "2026-02-01",
      rangeEnd: "2026-02-28",
      cards: [{ accountId: "card-1", accountName: "국민카드", paymentDay: 31 }],
    });

    expect(markers.get("2026-02-28")?.[0].kind).toBe("CARD_PAYMENT");
  });

  it("clamps a 31st payment day to a 29-day February", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "2028-02-01",
      rangeEnd: "2028-02-29",
      cards: [{ accountId: "card-1", accountName: "국민카드", paymentDay: 31 }],
    });

    expect(markers.get("2028-02-29")?.[0].kind).toBe("CARD_PAYMENT");
  });

  it("expands a monthly recurring rule across the range", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "2026-08-01",
      rangeEnd: "2026-10-31",
      recurringRules: [
        {
          id: "rule-1",
          memo: "월세",
          type: "EXPENSE",
          amount: 600_000,
          frequency: "MONTHLY",
          intervalCount: 1,
          dayOfMonth: 5,
          nextRunDate: "2026-08-05",
        },
      ],
    });

    expect(markers.get("2026-08-05")?.[0].label).toBe("월세");
    expect(markers.get("2026-09-05")?.[0].label).toBe("월세");
    expect(markers.get("2026-10-05")?.[0].label).toBe("월세");
  });

  it("stops expanding a recurring rule at its end date", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "2026-08-01",
      rangeEnd: "2026-10-31",
      recurringRules: [
        {
          id: "rule-1",
          memo: "월세",
          type: "EXPENSE",
          amount: 600_000,
          frequency: "MONTHLY",
          intervalCount: 1,
          dayOfMonth: 5,
          nextRunDate: "2026-08-05",
          endDate: "2026-09-30",
        },
      ],
    });

    expect(markers.get("2026-09-05")).toBeDefined();
    expect(markers.get("2026-10-05")).toBeUndefined();
  });

  it("does not double-mark a recurrence the cron already turned into a transaction", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "2026-08-01",
      rangeEnd: "2026-08-31",
      recurringRules: [
        {
          id: "rule-1",
          memo: "월세",
          type: "EXPENSE",
          amount: 600_000,
          frequency: "MONTHLY",
          intervalCount: 1,
          dayOfMonth: 5,
          nextRunDate: "2026-08-05",
        },
      ],
      confirmedRecurringDates: [{ ruleId: "rule-1", date: "2026-08-05" }],
    });

    expect(markers.get("2026-08-05")).toBeUndefined();
  });

  it("still marks another rule on a date where a different rule was already generated", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "2026-08-01",
      rangeEnd: "2026-08-31",
      recurringRules: [
        { id: "rule-1", memo: "월세", type: "EXPENSE", amount: 600_000, frequency: "MONTHLY", intervalCount: 1, dayOfMonth: 5, nextRunDate: "2026-08-05" },
        { id: "rule-2", memo: "통신비", type: "EXPENSE", amount: 55_000, frequency: "MONTHLY", intervalCount: 1, dayOfMonth: 5, nextRunDate: "2026-08-05" },
      ],
      confirmedRecurringDates: [{ ruleId: "rule-1", date: "2026-08-05" }],
    });

    expect(markers.get("2026-08-05")?.map((marker) => marker.label)).toEqual(["통신비"]);
  });

  it("expands a weekly rule", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "2026-08-01",
      rangeEnd: "2026-08-31",
      recurringRules: [
        { id: "rule-1", memo: "주간 저축", type: "EXPENSE", amount: 50_000, frequency: "WEEKLY", intervalCount: 1, nextRunDate: "2026-08-03" },
      ],
    });

    for (const date of ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31"]) {
      expect(markers.get(date)?.[0].label).toBe("주간 저축");
    }
  });

  it("sorts several markers on one day by kind", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "2026-08-01",
      rangeEnd: "2026-08-31",
      planned: [{ scheduledDate: "2026-08-25", type: "EXPENSE", amount: 10_000, baseAmount: 10_000, memo: "예정" }],
      cards: [{ accountId: "card-1", accountName: "국민카드", paymentDay: 25 }],
    });

    expect(markers.get("2026-08-25")?.map((marker) => marker.kind)).toEqual(["CARD_PAYMENT", "PLANNED"]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/calendar-upcoming.test.ts`
Expected: FAIL — `Cannot find module '@/domain/calendar/upcoming'`

- [ ] **Step 3: `upcoming.ts` 작성**

```ts
// src/domain/calendar/upcoming.ts
import { nextOccurrenceDate } from "@/domain/recurring/schedule";

import type { UpcomingKind, UpcomingMarker } from "./types";

// DAILY 규칙이 아주 오래 전에 시작된 경우를 대비한 안전장치.
// 정상 범위(6주 그리드)에서는 절대 닿지 않는다.
const MAX_RECURRENCE_STEPS = 4_000;

export type UpcomingPlanned = Readonly<{
  scheduledDate: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  baseAmount?: number;
  memo?: string;
}>;

export type UpcomingCard = Readonly<{ accountId: string; accountName: string; paymentDay: number }>;

export type UpcomingRecurringRule = Readonly<{
  id: string;
  memo?: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  intervalCount: number;
  dayOfMonth?: number;
  /** 이 날짜 이전 발생분은 이미 확정 거래로 생성되어 있다. */
  nextRunDate: string;
  endDate?: string;
}>;

export type UpcomingInput = Readonly<{
  rangeStart: string;
  rangeEnd: string;
  planned: readonly UpcomingPlanned[];
  cards: readonly UpcomingCard[];
  recurringRules: readonly UpcomingRecurringRule[];
  confirmedRecurringDates: readonly Readonly<{ ruleId: string; date: string }>[];
}>;

const KIND_ORDER: Record<UpcomingKind, number> = { CARD_PAYMENT: 0, RECURRING: 1, PLANNED: 2 };

function push(target: Map<string, UpcomingMarker[]>, date: string, marker: UpcomingMarker): void {
  const bucket = target.get(date) ?? [];
  bucket.push(marker);
  target.set(date, bucket);
}

function cardPaymentDates(rangeStart: string, rangeEnd: string, paymentDay: number): string[] {
  const [startYear, startMonth] = rangeStart.split("-").map(Number);
  const [endYear, endMonth] = rangeEnd.split("-").map(Number);
  const dates: string[] = [];

  for (let year = startYear, month = startMonth; year * 12 + month <= endYear * 12 + endMonth; month += 1) {
    if (month === 13) {
      year += 1;
      month = 1;
    }
    // 말일 보정: 31일 결제일 + 2월 → 그 달의 마지막 날.
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const day = Math.min(paymentDay, lastDay);
    const date = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (date >= rangeStart && date <= rangeEnd) dates.push(date);
  }

  return dates;
}

function recurrenceDates(rule: UpcomingRecurringRule, rangeStart: string, rangeEnd: string): string[] {
  const dates: string[] = [];
  let cursor = rule.nextRunDate;

  for (let step = 0; step < MAX_RECURRENCE_STEPS; step += 1) {
    if (cursor > rangeEnd) break;
    if (rule.endDate && cursor > rule.endDate) break;
    if (cursor >= rangeStart) dates.push(cursor);

    cursor = nextOccurrenceDate({
      frequency: rule.frequency,
      intervalCount: rule.intervalCount,
      dayOfMonth: rule.dayOfMonth,
      occurrenceDate: cursor,
    });
  }

  return dates;
}

/**
 * 달력에 겹쳐 보일 '미래' 항목을 날짜별로 모은다.
 * 반환값은 표시 전용이며 재정 규칙 7에 따라 어떤 합계에도 들어가지 않는다.
 */
export function collectUpcomingMarkers(input: UpcomingInput): ReadonlyMap<string, readonly UpcomingMarker[]> {
  const markers = new Map<string, UpcomingMarker[]>();

  for (const planned of input.planned) {
    if (planned.scheduledDate < input.rangeStart || planned.scheduledDate > input.rangeEnd) continue;
    push(markers, planned.scheduledDate, {
      kind: "PLANNED",
      label: planned.memo || (planned.type === "INCOME" ? "예정 수입" : "예정 지출"),
      amount: planned.baseAmount ?? planned.amount,
      direction: planned.type,
    });
  }

  for (const card of input.cards) {
    for (const date of cardPaymentDates(input.rangeStart, input.rangeEnd, card.paymentDay)) {
      // 금액은 청구 확정 전까지 알 수 없으므로 넣지 않는다.
      push(markers, date, { kind: "CARD_PAYMENT", label: `${card.accountName} 결제`, direction: "EXPENSE" });
    }
  }

  const alreadyGenerated = new Set(input.confirmedRecurringDates.map((item) => `${item.ruleId}:${item.date}`));
  for (const rule of input.recurringRules) {
    for (const date of recurrenceDates(rule, input.rangeStart, input.rangeEnd)) {
      if (alreadyGenerated.has(`${rule.id}:${date}`)) continue;
      push(markers, date, {
        kind: "RECURRING",
        label: rule.memo || (rule.type === "INCOME" ? "반복 수입" : "반복 지출"),
        amount: rule.amount,
        direction: rule.type,
      });
    }
  }

  for (const [date, bucket] of markers) {
    if (bucket.length === 0) {
      markers.delete(date);
      continue;
    }
    bucket.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  }

  return markers;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/unit/calendar-upcoming.test.ts`
Expected: PASS (12건)

- [ ] **Step 5: 타입 검사와 린트**

Run: `npm run typecheck && npm run lint`
Expected: 통과

- [ ] **Step 6: 커밋**

```bash
git add src/domain/calendar/upcoming.ts tests/unit/calendar-upcoming.test.ts
git commit -m "feat: collect planned, card, and recurring calendar markers"
```

---

## Task 11: 달력 서버 계층

**Files:**
- Create: `src/server/calendar/repository.ts`
- Create: `src/server/calendar/service.ts`
- Create: `src/server/calendar/index.ts`
- Test: `tests/unit/calendar-service.test.ts`

**Interfaces:**
- Consumes: `buildCalendarMonth`, `gridRange`, `collectUpcomingMarkers`, `seoulDayStartUtcIso`, `addIsoDays`, `todayInSeoul`
- Produces:
  - `service.ts`: `createCalendarService(repository: CalendarRepository)` → `{ getMonth(userId, year, month, today): Promise<CalendarMonth> }`, 인터페이스 `CalendarRepository`, 타입 `CalendarSourceData`
  - `index.ts`: `getCalendarMonthForCurrentUser(year: number, month: number): Promise<CalendarMonth>`

- [ ] **Step 1: 실패하는 테스트 작성**

리포지토리를 스텁으로 주입해 서비스의 조립 책임만 검증한다. Supabase는 건드리지 않는다.

```ts
// tests/unit/calendar-service.test.ts
import { describe, expect, it, vi } from "vitest";

import { createCalendarService, type CalendarSourceData } from "@/server/calendar/service";

const EMPTY: CalendarSourceData = {
  transactions: [],
  planned: [],
  cards: [],
  recurringRules: [],
  confirmedRecurringDates: [],
};

describe("calendar service", () => {
  it("asks the repository for the whole 42-cell grid range, not just the month", async () => {
    const getSourceData = vi.fn().mockResolvedValue(EMPTY);
    await createCalendarService({ getSourceData }).getMonth("user-1", 2026, 8, "2026-08-12");

    expect(getSourceData).toHaveBeenCalledWith("user-1", { start: "2026-07-26", end: "2026-09-05" });
  });

  it("builds a 42-cell month from the repository data", async () => {
    const month = await createCalendarService({
      getSourceData: async () => ({
        ...EMPTY,
        transactions: [
          { id: "1", type: "EXPENSE", status: "CONFIRMED", transactionAt: "2026-08-05T03:00:00Z", baseAmount: 47_000, memo: "점심", categoryName: "식비", accountName: "국민카드" },
        ],
      }),
    }).getMonth("user-1", 2026, 8, "2026-08-12");

    expect(month.cells).toHaveLength(42);
    expect(month.summary).toEqual({ income: 0, expense: 47_000, net: -47_000 });
    expect(month.cells.find((cell) => cell.date === "2026-08-05")?.transactions[0].memo).toBe("점심");
  });

  it("keeps planned transactions out of the summary while still marking them", async () => {
    const month = await createCalendarService({
      getSourceData: async () => ({
        ...EMPTY,
        planned: [{ scheduledDate: "2026-08-20", type: "EXPENSE", amount: 30_000, baseAmount: 30_000, memo: "치과" }],
      }),
    }).getMonth("user-1", 2026, 8, "2026-08-12");

    expect(month.summary.expense).toBe(0);
    expect(month.cells.find((cell) => cell.date === "2026-08-20")?.upcoming[0].label).toBe("치과");
  });

  it("marks the card payment day", async () => {
    const month = await createCalendarService({
      getSourceData: async () => ({ ...EMPTY, cards: [{ accountId: "c1", accountName: "국민카드", paymentDay: 25 }] }),
    }).getMonth("user-1", 2026, 8, "2026-08-12");

    expect(month.cells.find((cell) => cell.date === "2026-08-25")?.upcoming[0].kind).toBe("CARD_PAYMENT");
  });

  it("rejects a month outside 1..12", async () => {
    const service = createCalendarService({ getSourceData: async () => EMPTY });

    await expect(service.getMonth("user-1", 2026, 13, "2026-08-12")).rejects.toThrow();
    await expect(service.getMonth("user-1", 2026, 0, "2026-08-12")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/calendar-service.test.ts`
Expected: FAIL — `Cannot find module '@/server/calendar/service'`

- [ ] **Step 3: `service.ts` 작성**

```ts
// src/server/calendar/service.ts
import "server-only";

import { buildCalendarMonth, gridRange, type SourceTransaction } from "@/domain/calendar/month";
import type { CalendarMonth } from "@/domain/calendar/types";
import {
  collectUpcomingMarkers,
  type UpcomingCard,
  type UpcomingPlanned,
  type UpcomingRecurringRule,
} from "@/domain/calendar/upcoming";

export type CalendarSourceData = Readonly<{
  transactions: readonly SourceTransaction[];
  planned: readonly UpcomingPlanned[];
  cards: readonly UpcomingCard[];
  recurringRules: readonly UpcomingRecurringRule[];
  confirmedRecurringDates: readonly Readonly<{ ruleId: string; date: string }>[];
}>;

export interface CalendarRepository {
  getSourceData(userId: string, range: Readonly<{ start: string; end: string }>): Promise<CalendarSourceData>;
}

export function createCalendarService(repository: CalendarRepository) {
  return {
    async getMonth(userId: string, year: number, month: number, today: string): Promise<CalendarMonth> {
      if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError("month must be between 1 and 12");
      if (!Number.isInteger(year) || year < 1970 || year > 9999) throw new RangeError("year is out of range");

      // 그리드는 이웃 달 날짜를 포함하므로 조회 범위도 42칸 전체로 잡는다.
      const range = gridRange(year, month);
      const data = await repository.getSourceData(userId, range);

      const upcoming = collectUpcomingMarkers({
        rangeStart: range.start,
        rangeEnd: range.end,
        planned: data.planned,
        cards: data.cards,
        recurringRules: data.recurringRules,
        confirmedRecurringDates: data.confirmedRecurringDates,
      });

      return buildCalendarMonth({ year, month, today, transactions: data.transactions, upcoming });
    },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/unit/calendar-service.test.ts`
Expected: PASS (5건)

- [ ] **Step 5: `repository.ts` 작성**

```ts
// src/server/calendar/repository.ts
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { toSeoulDate, addIsoDays, seoulDayStartUtcIso } from "@/lib/dates/seoul";
import type { CalendarRepository, CalendarSourceData } from "@/server/calendar/service";

type NamedRow = { name: string } | { name: string }[] | null;

function firstName(value: NamedRow): string | undefined {
  if (!value) return undefined;
  const row = Array.isArray(value) ? value[0] : value;
  return row?.name;
}

export function createCalendarRepository(supabase: SupabaseClient): CalendarRepository {
  return {
    async getSourceData(userId, range): Promise<CalendarSourceData> {
      // transaction_at은 timestamptz다. Asia/Seoul 하루 경계를 UTC 순간으로
      // 바꿔서 비교해야 한국 시간 기준 날짜가 맞는다.
      const fromInstant = seoulDayStartUtcIso(range.start);
      const toInstant = seoulDayStartUtcIso(addIsoDays(range.end, 1));

      const [transactions, planned, cards, rules] = await Promise.all([
        supabase
          .from("transactions")
          .select(
            "id,type,status,transaction_at,base_amount,memo,recurring_rule_id,categories(name),accounts!transactions_account_id_fkey(name)",
          )
          .eq("user_id", userId)
          .eq("status", "CONFIRMED")
          .in("type", ["INCOME", "EXPENSE"])
          .gte("transaction_at", fromInstant)
          .lt("transaction_at", toInstant)
          .order("transaction_at"),
        supabase
          .from("planned_transactions")
          .select("scheduled_date,type,amount,base_amount,memo")
          .eq("user_id", userId)
          .eq("status", "PLANNED")
          .gte("scheduled_date", range.start)
          .lte("scheduled_date", range.end),
        supabase
          .from("credit_card_settings")
          .select("account_id,payment_day,accounts!credit_card_settings_account_id_fkey(name)")
          .eq("user_id", userId),
        supabase
          .from("recurring_rules")
          .select("id,memo,type,amount,frequency,interval_count,day_of_month,next_run_date,end_date")
          .eq("user_id", userId)
          .eq("is_active", true),
      ]);

      for (const result of [transactions, planned, cards, rules]) {
        if (result.error) throw new Error(result.error.message);
      }

      const transactionRows = transactions.data ?? [];

      return {
        transactions: transactionRows.map((row) => ({
          id: String(row.id),
          type: row.type as "INCOME" | "EXPENSE",
          status: "CONFIRMED" as const,
          transactionAt: String(row.transaction_at),
          baseAmount: Number(row.base_amount),
          memo: row.memo ? String(row.memo) : undefined,
          categoryName: firstName(row.categories as NamedRow),
          accountName: firstName(row.accounts as NamedRow),
        })),
        planned: (planned.data ?? []).map((row) => ({
          scheduledDate: String(row.scheduled_date),
          type: row.type as "INCOME" | "EXPENSE",
          amount: Number(row.amount),
          baseAmount: row.base_amount === null || row.base_amount === undefined ? undefined : Number(row.base_amount),
          memo: row.memo ? String(row.memo) : undefined,
        })),
        cards: (cards.data ?? []).map((row) => ({
          accountId: String(row.account_id),
          accountName: firstName(row.accounts as NamedRow) ?? "카드",
          paymentDay: Number(row.payment_day),
        })),
        recurringRules: (rules.data ?? []).map((row) => ({
          id: String(row.id),
          memo: row.memo ? String(row.memo) : undefined,
          type: row.type as "INCOME" | "EXPENSE",
          amount: Number(row.amount),
          frequency: row.frequency as "DAILY" | "WEEKLY" | "MONTHLY",
          intervalCount: Number(row.interval_count),
          dayOfMonth: row.day_of_month === null || row.day_of_month === undefined ? undefined : Number(row.day_of_month),
          nextRunDate: String(row.next_run_date),
          endDate: row.end_date ? String(row.end_date) : undefined,
        })),
        // 이미 확정 거래로 생성된 반복 발생일. 같은 날짜에 마커를 중복으로 찍지 않기 위해 쓴다.
        confirmedRecurringDates: transactionRows
          .filter((row) => row.recurring_rule_id)
          .map((row) => ({
            ruleId: String(row.recurring_rule_id),
            date: toSeoulDate(String(row.transaction_at)),
          })),
      };
    },
  };
}
```

- [ ] **Step 6: `index.ts` 작성**

```ts
// src/server/calendar/index.ts
import "server-only";

import { todayInSeoul } from "@/lib/dates/seoul";
import { requireCurrentProfile } from "@/server/auth/require-profile";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { createCalendarRepository } from "./repository";
import { createCalendarService } from "./service";

export async function getCalendarMonthForCurrentUser(year: number, month: number) {
  const [profile, supabase] = await Promise.all([requireCurrentProfile(), createSupabaseServerClient()]);
  return createCalendarService(createCalendarRepository(supabase)).getMonth(profile.id, year, month, todayInSeoul());
}
```

- [ ] **Step 7: 스키마 컬럼명 확인**

Run: `grep -n "recurring_rules" -A 20 supabase/migrations/20260810070659_core_schema.sql | head -40`
Expected: `interval_count`, `day_of_month`, `next_run_date`, `end_date`, `is_active`, `memo`, `amount`, `type` 컬럼이 존재한다. 이름이 다르면 리포지토리의 `select`와 매핑을 실제 컬럼명에 맞춘다.

`accounts!credit_card_settings_account_id_fkey` 제약 이름도 확인한다.

Run: `grep -n "credit_card_settings" -A 15 supabase/migrations/20260810070659_core_schema.sql`
Expected: `account_id`의 외래키 이름을 확인. 다르면 embed 힌트를 실제 이름으로 고친다. 힌트 없이 `accounts(name)`만 쓰면 `payment_account_id`와 모호해져 쿼리가 실패한다 (커밋 `d60ed61`에서 같은 문제를 이미 겪었다).

- [ ] **Step 8: 타입 검사와 린트**

Run: `npm run typecheck && npm run lint`
Expected: 통과

- [ ] **Step 9: 전체 스위트**

Run: `npm run test`
Expected: 통과

- [ ] **Step 10: 커밋**

```bash
git add src/server/calendar tests/unit/calendar-service.test.ts
git commit -m "feat: add calendar month repository and service"
```

---

## Task 12: 달력 셀과 그리드 컴포넌트

**Files:**
- Create: `src/components/calendar/CalendarDayCell.tsx`
- Create: `src/components/calendar/CalendarGrid.tsx`
- Test: `tests/unit/calendar-grid.test.tsx`

**Interfaces:**
- Consumes: `CalendarCell` (Task 9 타입), Task 1 토큰
- Produces:
  - `CalendarDayCell`: `({ cell: CalendarCell; selected: boolean; tabIndex: number; onSelect: (date: string) => void })`
  - `CalendarGrid`: `({ cells: readonly CalendarCell[]; selectedDate: string | null; onSelect: (date: string) => void })`
  - `formatDayAriaLabel(cell: CalendarCell): string` (`CalendarDayCell.tsx`에서 export)

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// tests/unit/calendar-grid.test.tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { formatDayAriaLabel } from "@/components/calendar/CalendarDayCell";
import type { CalendarCell } from "@/domain/calendar/types";

afterEach(cleanup);

function cell(overrides: Partial<CalendarCell> & Pick<CalendarCell, "date">): CalendarCell {
  return {
    inCurrentMonth: true,
    isToday: false,
    weekday: 0,
    income: 0,
    expense: 0,
    heatLevel: 0,
    transactions: [],
    upcoming: [],
    ...overrides,
  };
}

// 42칸을 채우되 관심 있는 칸만 덮어쓴다.
function grid(overrides: readonly CalendarCell[]): CalendarCell[] {
  const cells = Array.from({ length: 42 }, (_, index) =>
    cell({ date: `2026-08-${String(index + 1).padStart(2, "0")}`, weekday: index % 7 }),
  );
  for (const override of overrides) {
    const at = cells.findIndex((item) => item.date === override.date);
    if (at >= 0) cells[at] = override;
  }
  return cells;
}

describe("formatDayAriaLabel", () => {
  it("states the date, the expense, and the upcoming count as text", () => {
    const label = formatDayAriaLabel(
      cell({
        date: "2026-08-05",
        weekday: 3,
        expense: 47_000,
        upcoming: [{ kind: "PLANNED", label: "치과", amount: 30_000, direction: "EXPENSE" }],
      }),
    );

    expect(label).toContain("8월 5일");
    expect(label).toContain("수요일");
    expect(label).toContain("지출 47,000원");
    expect(label).toContain("예정 1건");
  });

  it("mentions income when there is income", () => {
    expect(formatDayAriaLabel(cell({ date: "2026-08-25", income: 2_500_000 }))).toContain("수입 2,500,000원");
  });

  it("says there is no record on an empty day", () => {
    expect(formatDayAriaLabel(cell({ date: "2026-08-07" }))).toContain("기록 없음");
  });
});

describe("CalendarGrid", () => {
  it("renders a gridcell for all 42 days", () => {
    render(<CalendarGrid cells={grid([])} selectedDate={null} onSelect={() => {}} />);

    expect(screen.getAllByRole("gridcell")).toHaveLength(42);
  });

  it("shows an income line only on days that have income", () => {
    render(
      <CalendarGrid
        cells={grid([cell({ date: "2026-08-25", income: 2_500_000 }), cell({ date: "2026-08-05", expense: 47_000 })])}
        selectedDate={null}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText("+2,500,000")).toBeTruthy();
    expect(screen.getByText("-47,000")).toBeTruthy();
  });

  it("marks a day that has upcoming items", () => {
    render(
      <CalendarGrid
        cells={grid([
          cell({ date: "2026-08-12", upcoming: [{ kind: "CARD_PAYMENT", label: "국민카드 결제", direction: "EXPENSE" }] }),
        ])}
        selectedDate={null}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByLabelText(/8월 12일.*예정 1건/)).toBeTruthy();
  });

  it("reports the chosen date", () => {
    const onSelect = vi.fn();
    render(<CalendarGrid cells={grid([])} selectedDate={null} onSelect={onSelect} />);

    fireEvent.click(screen.getByLabelText(/8월 5일/));

    expect(onSelect).toHaveBeenCalledWith("2026-08-05");
  });

  it("moves focus one day right on ArrowRight", () => {
    render(<CalendarGrid cells={grid([])} selectedDate="2026-08-05" onSelect={() => {}} />);
    const start = screen.getByLabelText(/8월 5일/);
    start.focus();

    fireEvent.keyDown(start, { key: "ArrowRight" });

    expect(document.activeElement).toBe(screen.getByLabelText(/8월 6일/));
  });

  it("moves focus one week down on ArrowDown", () => {
    render(<CalendarGrid cells={grid([])} selectedDate="2026-08-05" onSelect={() => {}} />);
    const start = screen.getByLabelText(/8월 5일/);
    start.focus();

    fireEvent.keyDown(start, { key: "ArrowDown" });

    expect(document.activeElement).toBe(screen.getByLabelText(/8월 12일/));
  });

  it("keeps focus in place at the grid edge", () => {
    render(<CalendarGrid cells={grid([])} selectedDate="2026-08-01" onSelect={() => {}} />);
    const start = screen.getByLabelText(/8월 1일/);
    start.focus();

    fireEvent.keyDown(start, { key: "ArrowLeft" });

    expect(document.activeElement).toBe(start);
  });

  it("selects the focused day on Enter", () => {
    const onSelect = vi.fn();
    render(<CalendarGrid cells={grid([])} selectedDate={null} onSelect={onSelect} />);
    const target = screen.getByLabelText(/8월 9일/);

    fireEvent.keyDown(target, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith("2026-08-09");
  });

  it("gives only one cell a tab stop", () => {
    render(<CalendarGrid cells={grid([])} selectedDate="2026-08-05" onSelect={() => {}} />);
    const tabbable = screen.getAllByRole("gridcell").filter((node) => node.getAttribute("tabindex") === "0");

    expect(tabbable).toHaveLength(1);
    expect(tabbable[0].getAttribute("aria-label")).toContain("8월 5일");
  });

  it("labels the weekday header row", () => {
    render(<CalendarGrid cells={grid([])} selectedDate={null} onSelect={() => {}} />);

    for (const day of ["일", "월", "화", "수", "목", "금", "토"]) {
      expect(screen.getByRole("columnheader", { name: day })).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/calendar-grid.test.tsx`
Expected: FAIL — `Cannot find module '@/components/calendar/CalendarGrid'`

- [ ] **Step 3: `CalendarDayCell.tsx` 작성**

```tsx
// src/components/calendar/CalendarDayCell.tsx
"use client";

import type { CalendarCell, HeatLevel } from "@/domain/calendar/types";
import { cx } from "@/components/ui/cx";

const WEEKDAY_NAMES = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"] as const;

// 히트맵은 배경 농도로만 말하지 않는다. 금액 텍스트와 aria-label이 같은 내용을 전한다.
const HEAT_CLASSES: Record<HeatLevel, string> = {
  0: "",
  1: "bg-brand-500/6",
  2: "bg-brand-500/12",
  3: "bg-brand-500/20",
  4: "bg-brand-500/30",
};

const won = (value: number) => `${value.toLocaleString("ko-KR")}원`;

export function formatDayAriaLabel(cell: CalendarCell): string {
  const [, month, day] = cell.date.split("-").map(Number);
  const parts = [`${month}월 ${day}일`, WEEKDAY_NAMES[cell.weekday]];

  if (cell.income > 0) parts.push(`수입 ${won(cell.income)}`);
  if (cell.expense > 0) parts.push(`지출 ${won(cell.expense)}`);
  if (cell.income === 0 && cell.expense === 0) parts.push("기록 없음");
  if (cell.upcoming.length > 0) parts.push(`예정 ${cell.upcoming.length}건`);
  if (cell.isToday) parts.push("오늘");

  return parts.join(", ");
}

export function CalendarDayCell({
  cell,
  selected,
  tabIndex,
  onSelect,
}: Readonly<{ cell: CalendarCell; selected: boolean; tabIndex: number; onSelect: (date: string) => void }>) {
  const dayNumber = Number(cell.date.slice(8, 10));
  const hasUpcoming = cell.upcoming.length > 0;

  return (
    <div
      role="gridcell"
      tabIndex={tabIndex}
      data-date={cell.date}
      aria-label={formatDayAriaLabel(cell)}
      aria-selected={selected}
      onClick={() => onSelect(cell.date)}
      className={cx(
        "flex min-h-16 cursor-pointer flex-col gap-0.5 rounded-tile border p-1.5 text-left transition-colors sm:min-h-20 sm:p-2",
        HEAT_CLASSES[cell.heatLevel],
        cell.inCurrentMonth ? "border-transparent" : "border-transparent opacity-40",
        selected ? "ring-2 ring-brand-500" : "",
        // 확정은 실선 영역, 예정은 점선 하단 보더로 구분한다.
        hasUpcoming ? "border-b-2 border-b-dashed border-b-brand-400/70" : "",
      )}
    >
      <span
        className={cx(
          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
          cell.isToday ? "bg-brand-600 text-white" : "",
          !cell.isToday && cell.weekday === 0 ? "text-negative-600 dark:text-negative-500" : "",
          !cell.isToday && cell.weekday === 6 ? "text-brand-600 dark:text-brand-400" : "",
          !cell.isToday && cell.weekday > 0 && cell.weekday < 6 ? "text-content-secondary" : "",
        )}
      >
        {dayNumber}
      </span>

      <span aria-hidden="true" className="mt-auto flex flex-col gap-px text-[10px] font-semibold leading-tight tabular-nums sm:text-xs">
        {cell.income > 0 ? (
          <span className="truncate text-positive-600 dark:text-positive-500">+{cell.income.toLocaleString("ko-KR")}</span>
        ) : null}
        {cell.expense > 0 ? (
          <span className="truncate text-content-primary">-{cell.expense.toLocaleString("ko-KR")}</span>
        ) : null}
        {hasUpcoming ? <span className="truncate text-content-muted">예정 {cell.upcoming.length}</span> : null}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: `CalendarGrid.tsx` 작성**

```tsx
// src/components/calendar/CalendarGrid.tsx
"use client";

import { useRef } from "react";

import { CalendarDayCell } from "@/components/calendar/CalendarDayCell";
import type { CalendarCell } from "@/domain/calendar/types";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

const STEP_BY_KEY: Record<string, number> = {
  ArrowRight: 1,
  ArrowLeft: -1,
  ArrowDown: 7,
  ArrowUp: -7,
};

export function CalendarGrid({
  cells,
  selectedDate,
  onSelect,
}: Readonly<{ cells: readonly CalendarCell[]; selectedDate: string | null; onSelect: (date: string) => void }>) {
  const gridRef = useRef<HTMLDivElement>(null);

  // 로빙 탭 인덱스: 그리드 전체가 탭 정지점 하나만 갖는다.
  const focusIndex = Math.max(
    0,
    cells.findIndex((cell) => (selectedDate ? cell.date === selectedDate : cell.isToday)),
  );

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const date = target.dataset.date;
    if (!date) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(date);
      return;
    }

    const step = STEP_BY_KEY[event.key];
    if (step === undefined) return;

    const current = cells.findIndex((cell) => cell.date === date);
    const next = current + step;
    // 그리드 경계에서는 움직이지 않는다.
    if (current < 0 || next < 0 || next >= cells.length) return;

    event.preventDefault();
    gridRef.current
      ?.querySelector<HTMLElement>(`[data-date="${cells[next].date}"]`)
      ?.focus();
  }

  return (
    <div ref={gridRef} role="grid" aria-label="월별 기록" onKeyDown={onKeyDown} className="flex flex-col gap-1">
      <div role="row" className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} role="columnheader" className="py-1 text-center text-xs font-semibold text-content-muted">
            {label}
          </div>
        ))}
      </div>

      {Array.from({ length: cells.length / 7 }, (_, week) => (
        <div key={week} role="row" className="grid grid-cols-7 gap-1">
          {cells.slice(week * 7, week * 7 + 7).map((cell, offset) => (
            <CalendarDayCell
              key={cell.date}
              cell={cell}
              selected={cell.date === selectedDate}
              tabIndex={week * 7 + offset === focusIndex ? 0 : -1}
              onSelect={onSelect}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run tests/unit/calendar-grid.test.tsx`
Expected: PASS (13건)

- [ ] **Step 6: 커밋**

```bash
git add src/components/calendar tests/unit/calendar-grid.test.tsx
git commit -m "feat: add accessible calendar grid with keyboard navigation"
```

---

## Task 13: 달력 페이지와 상세 패널

**Files:**
- Create: `src/components/calendar/CalendarDaySheet.tsx`
- Create: `src/components/calendar/CalendarMonthView.tsx`
- Create: `src/app/(app)/(shell)/calendar/page.tsx`
- Modify: `src/components/transactions/QuickEntryForm.tsx`
- Modify: `src/app/(app)/(shell)/transactions/new/page.tsx`
- Test: `tests/unit/calendar-month-view.test.tsx`

**Interfaces:**
- Consumes: `CalendarGrid`, `Sheet`, `Segmented`, `getCalendarMonthForCurrentUser`, `parseYearMonth`, `todayInSeoul`
- Produces:
  - `CalendarDaySheet`: `({ cell: CalendarCell | null; onClose: () => void })`
  - `CalendarMonthView`: `({ month: CalendarMonth })`
  - `QuickEntryForm`에 `defaultDate?: string` prop 추가

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// tests/unit/calendar-month-view.test.tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/calendar",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { CalendarMonthView } from "@/components/calendar/CalendarMonthView";
import type { CalendarCell, CalendarMonth } from "@/domain/calendar/types";

afterEach(cleanup);

function cell(overrides: Partial<CalendarCell> & Pick<CalendarCell, "date">): CalendarCell {
  return {
    inCurrentMonth: true,
    isToday: false,
    weekday: 0,
    income: 0,
    expense: 0,
    heatLevel: 0,
    transactions: [],
    upcoming: [],
    ...overrides,
  };
}

function month(overrides: readonly CalendarCell[] = [], summary = { income: 0, expense: 0, net: 0 }): CalendarMonth {
  const cells = Array.from({ length: 42 }, (_, index) =>
    cell({ date: `2026-08-${String(index + 1).padStart(2, "0")}`, weekday: index % 7 }),
  );
  for (const override of overrides) {
    const at = cells.findIndex((item) => item.date === override.date);
    if (at >= 0) cells[at] = override;
  }
  return { year: 2026, month: 8, cells, summary };
}

describe("CalendarMonthView", () => {
  it("titles the month and shows the summary", () => {
    render(<CalendarMonthView month={month([], { income: 2_500_000, expense: 47_000, net: 2_453_000 })} />);

    expect(screen.getByRole("heading", { name: "2026년 8월" })).toBeTruthy();
    expect(screen.getByText("2,500,000원")).toBeTruthy();
    expect(screen.getByText("47,000원")).toBeTruthy();
  });

  it("links to the neighbouring months through the ym query", () => {
    render(<CalendarMonthView month={month()} />);

    expect(screen.getByRole("link", { name: "이전 달" }).getAttribute("href")).toBe("/calendar?ym=2026-07");
    expect(screen.getByRole("link", { name: "다음 달" }).getAttribute("href")).toBe("/calendar?ym=2026-09");
  });

  it("crosses the year boundary in the month links", () => {
    const december: CalendarMonth = { ...month(), year: 2026, month: 12 };
    render(<CalendarMonthView month={december} />);

    expect(screen.getByRole("link", { name: "이전 달" }).getAttribute("href")).toBe("/calendar?ym=2026-11");
    expect(screen.getByRole("link", { name: "다음 달" }).getAttribute("href")).toBe("/calendar?ym=2027-01");
  });

  it("opens the day sheet with that day's transactions", () => {
    const view = month([
      cell({
        date: "2026-08-05",
        expense: 47_000,
        transactions: [
          { id: "t1", type: "EXPENSE", baseAmount: 47_000, memo: "점심", categoryName: "식비", accountName: "국민카드" },
        ],
      }),
    ]);
    render(<CalendarMonthView month={view} />);

    fireEvent.click(screen.getByLabelText(/8월 5일/));

    expect(screen.getByRole("dialog", { name: "2026년 8월 5일" })).toBeTruthy();
    expect(screen.getByText("점심")).toBeTruthy();
    expect(screen.getByText("식비 · 국민카드")).toBeTruthy();
  });

  it("separates upcoming items from confirmed ones in the sheet", () => {
    const view = month([
      cell({
        date: "2026-08-25",
        upcoming: [{ kind: "CARD_PAYMENT", label: "국민카드 결제", direction: "EXPENSE" }],
      }),
    ]);
    render(<CalendarMonthView month={view} />);

    fireEvent.click(screen.getByLabelText(/8월 25일/));

    expect(screen.getByRole("heading", { name: "예정" })).toBeTruthy();
    expect(screen.getByText("국민카드 결제")).toBeTruthy();
  });

  it("offers a record link seeded with the chosen date", () => {
    render(<CalendarMonthView month={month()} />);

    fireEvent.click(screen.getByLabelText(/8월 5일/));

    expect(screen.getByRole("link", { name: "이 날짜로 기록" }).getAttribute("href")).toBe(
      "/transactions/new?date=2026-08-05",
    );
  });

  it("prompts to start recording when the month is empty", () => {
    render(<CalendarMonthView month={month()} />);

    expect(screen.getByText(/이번 달 기록이 아직 없어요/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "첫 거래 기록" }).getAttribute("href")).toBe("/transactions/new");
  });

  it("hides the empty state once the month has a transaction", () => {
    const view = month([cell({ date: "2026-08-05", expense: 47_000 })], { income: 0, expense: 47_000, net: -47_000 });
    render(<CalendarMonthView month={view} />);

    expect(screen.queryByText(/이번 달 기록이 아직 없어요/)).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/calendar-month-view.test.tsx`
Expected: FAIL — `Cannot find module '@/components/calendar/CalendarMonthView'`

- [ ] **Step 3: `CalendarDaySheet.tsx` 작성**

```tsx
// src/components/calendar/CalendarDaySheet.tsx
"use client";

import Link from "next/link";

import { Sheet } from "@/components/ui/Sheet";
import type { CalendarCell } from "@/domain/calendar/types";

const won = (value: number) => `${value.toLocaleString("ko-KR")}원`;

function titleFor(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

export function CalendarDaySheet({ cell, onClose }: Readonly<{ cell: CalendarCell | null; onClose: () => void }>) {
  return (
    <Sheet open={cell !== null} onClose={onClose} title={cell ? titleFor(cell.date) : ""}>
      {cell ? (
        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-2 gap-2">
            <div className="rounded-tile bg-surface-base p-3">
              <dt className="text-xs text-content-secondary">수입</dt>
              <dd className="text-base font-bold tabular-nums text-positive-600 dark:text-positive-500">
                {won(cell.income)}
              </dd>
            </div>
            <div className="rounded-tile bg-surface-base p-3">
              <dt className="text-xs text-content-secondary">지출</dt>
              <dd className="text-base font-bold tabular-nums text-content-primary">{won(cell.expense)}</dd>
            </div>
          </dl>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-bold text-content-primary">확정 거래</h3>
            {cell.transactions.length === 0 ? (
              <p className="text-sm text-content-muted">이 날 기록된 거래가 없어요.</p>
            ) : (
              <ul className="flex list-none flex-col gap-2 p-0">
                {cell.transactions.map((transaction) => (
                  <li key={transaction.id}>
                    <Link
                      href={`/transactions/${transaction.id}/edit`}
                      className="flex items-start justify-between gap-3 rounded-tile border border-border-subtle p-3 no-underline hover:bg-surface-base"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-content-primary">
                          {transaction.memo || transaction.categoryName || "거래"}
                        </span>
                        <span className="block truncate text-xs text-content-muted">
                          {[transaction.categoryName, transaction.accountName].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span
                        className={
                          transaction.type === "INCOME"
                            ? "shrink-0 text-sm font-bold tabular-nums text-positive-600 dark:text-positive-500"
                            : "shrink-0 text-sm font-bold tabular-nums text-content-primary"
                        }
                      >
                        {transaction.type === "INCOME" ? "+" : "-"}
                        {transaction.baseAmount.toLocaleString("ko-KR")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {cell.upcoming.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-content-primary">예정</h3>
              {/* 예정 항목은 실제 통계에 포함되지 않는다는 점을 문구로도 밝힌다. */}
              <p className="text-xs text-content-muted">아직 확정되지 않아 수입·지출 합계에는 포함되지 않아요.</p>
              <ul className="flex list-none flex-col gap-2 p-0">
                {cell.upcoming.map((marker, index) => (
                  <li
                    key={`${marker.kind}-${index}`}
                    className="flex items-start justify-between gap-3 rounded-tile border border-dashed border-border-strong p-3"
                  >
                    <span className="min-w-0 truncate text-sm text-content-secondary">{marker.label}</span>
                    {marker.amount !== undefined ? (
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-content-muted">
                        {marker.direction === "INCOME" ? "+" : "-"}
                        {marker.amount.toLocaleString("ko-KR")}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <Link
            href={`/transactions/new?date=${cell.date}`}
            className="inline-flex items-center justify-center rounded-tile bg-gradient-to-br from-brand-600 to-brand-500 px-4 py-2.5 text-sm font-semibold text-white no-underline shadow-card"
          >
            이 날짜로 기록
          </Link>
        </div>
      ) : null}
    </Sheet>
  );
}
```

- [ ] **Step 4: `CalendarMonthView.tsx` 작성**

```tsx
// src/components/calendar/CalendarMonthView.tsx
"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useRef, useState } from "react";

import { CalendarDaySheet } from "@/components/calendar/CalendarDaySheet";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { springSoft } from "@/components/motion/presets";
import { Card } from "@/components/ui/Card";
import type { CalendarMonth } from "@/domain/calendar/types";

const won = (value: number) => `${value.toLocaleString("ko-KR")}원`;

function shiftMonth(year: number, month: number, delta: number): string {
  const index = year * 12 + (month - 1) + delta;
  return `${String(Math.floor(index / 12)).padStart(4, "0")}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function CalendarMonthView({ month }: Readonly<{ month: CalendarMonth }>) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // 서버 내비게이션으로 월이 바뀌어도 이 클라이언트 인스턴스는 살아 있으므로
  // 직전 월을 기억해 슬라이드 방향을 정할 수 있다.
  const key = `${month.year}-${month.month}`;
  const previousKey = useRef(key);
  const direction = key === previousKey.current ? 0 : key > previousKey.current ? 1 : -1;
  previousKey.current = key;

  const selectedCell = selectedDate ? (month.cells.find((cell) => cell.date === selectedDate) ?? null) : null;
  const hasRecords = month.cells.some((cell) => cell.inCurrentMonth && (cell.income > 0 || cell.expense > 0));

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Link
              href={`/calendar?ym=${shiftMonth(month.year, month.month, -1)}`}
              aria-label="이전 달"
              className="rounded-full px-2.5 py-1.5 text-content-secondary no-underline hover:bg-surface-base"
            >
              ◀
            </Link>
            <h2 className="min-w-32 text-center text-lg font-bold tracking-tight text-content-primary">
              {month.year}년 {month.month}월
            </h2>
            <Link
              href={`/calendar?ym=${shiftMonth(month.year, month.month, 1)}`}
              aria-label="다음 달"
              className="rounded-full px-2.5 py-1.5 text-content-secondary no-underline hover:bg-surface-base"
            >
              ▶
            </Link>
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-2">
          <div className="rounded-tile bg-surface-base p-3">
            <dt className="text-xs text-content-secondary">수입</dt>
            <dd className="text-sm font-bold tabular-nums text-positive-600 sm:text-base dark:text-positive-500">
              {won(month.summary.income)}
            </dd>
          </div>
          <div className="rounded-tile bg-surface-base p-3">
            <dt className="text-xs text-content-secondary">지출</dt>
            <dd className="text-sm font-bold tabular-nums text-content-primary sm:text-base">
              {won(month.summary.expense)}
            </dd>
          </div>
          <div className="rounded-tile bg-surface-base p-3">
            <dt className="text-xs text-content-secondary">순액</dt>
            <dd className="text-sm font-bold tabular-nums text-content-primary sm:text-base">
              {month.summary.net >= 0 ? "+" : "-"}
              {won(Math.abs(month.summary.net))}
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <motion.div
          key={key}
          initial={{ opacity: 0, x: direction * 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={springSoft}
        >
          <CalendarGrid cells={month.cells} selectedDate={selectedDate} onSelect={setSelectedDate} />
        </motion.div>
      </Card>

      {hasRecords ? null : (
        <Card className="flex flex-col items-start gap-2 text-sm">
          <p className="font-semibold text-content-primary">이번 달 기록이 아직 없어요.</p>
          <p className="text-content-secondary">첫 지출을 기록하면 이 달력에 소비 흐름이 그려집니다.</p>
          <Link
            href="/transactions/new"
            className="mt-1 inline-flex items-center justify-center rounded-tile bg-gradient-to-br from-brand-600 to-brand-500 px-4 py-2 text-sm font-semibold text-white no-underline shadow-card"
          >
            첫 거래 기록
          </Link>
        </Card>
      )}

      <CalendarDaySheet cell={selectedCell} onClose={() => setSelectedDate(null)} />
    </div>
  );
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run tests/unit/calendar-month-view.test.tsx`
Expected: PASS (8건)

- [ ] **Step 6: 달력 페이지 작성**

```tsx
// src/app/(app)/(shell)/calendar/page.tsx
import { CalendarMonthView } from "@/components/calendar/CalendarMonthView";
import { PageHeader } from "@/components/ui/PageHeader";
import { parseYearMonth } from "@/domain/calendar/month";
import { todayInSeoul } from "@/lib/dates/seoul";
import { getCalendarMonthForCurrentUser } from "@/server/calendar";

type RawSearchParams = Record<string, string | string[] | undefined>;

export default async function CalendarPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = await searchParams;
  const raw = params.ym;
  const ym = Array.isArray(raw) ? raw[0] : raw;

  // 잘못된 ym은 이번 달로 조용히 폴백한다. 링크가 깨져도 화면은 뜬다.
  const { year, month } = parseYearMonth(ym, todayInSeoul());
  const data = await getCalendarMonthForCurrentUser(year, month);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="달력" />
      <CalendarMonthView month={data} />
    </div>
  );
}
```

- [ ] **Step 7: `QuickEntryForm`에 `defaultDate` 추가**

`src/components/transactions/QuickEntryForm.tsx`에서:

1. props 타입에 `defaultDate?: string;`를 추가하고 시그니처 구조분해에 `defaultDate`를 넣는다.
2. `transactionAt` 초기값을 바꾼다.

```tsx
  // 달력에서 넘어온 날짜가 있으면 그 날 정오를 초기값으로 채운다.
  // datetime-local은 YYYY-MM-DDTHH:mm 형식을 요구한다.
  const [transactionAt, setTransactionAt] = useState(defaultDate ? `${defaultDate}T12:00` : "");
```

3. 날짜가 미리 채워졌으면 상세 옵션을 펼친 채로 시작해 사용자가 값을 확인할 수 있게 한다.

```tsx
  const [showDetails, setShowDetails] = useState(Boolean(defaultDate));
```

- [ ] **Step 8: 거래 입력 페이지가 `date` 쿼리를 넘기도록 수정**

`src/app/(app)/(shell)/transactions/new/page.tsx`를 읽고, `searchParams`에서 `date`를 꺼내 `QuickEntryForm`에 `defaultDate`로 넘긴다. 페이지가 아직 `searchParams`를 받지 않는다면 다음 시그니처를 추가한다.

```tsx
export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.date;
  const requested = Array.isArray(raw) ? raw[0] : raw;
  // YYYY-MM-DD 형태만 받아들인다.
  const defaultDate = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : undefined;
  // ... 기존 데이터 로딩 유지 ...
  // <QuickEntryForm ... defaultDate={defaultDate} />
}
```

- [ ] **Step 9: 주간 뷰 토글의 실패 테스트 추가**

`tests/unit/calendar-month-view.test.tsx`의 `describe` 안에 아래 3건을 추가한다. 기존 8건은 그대로 둔다.

```tsx
  it("offers a month and week toggle", () => {
    render(<CalendarMonthView month={month()} />);

    expect(screen.getByRole("radiogroup", { name: "보기 방식" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "월" }).getAttribute("aria-checked")).toBe("true");
  });

  it("narrows the grid to one week in week view", () => {
    render(<CalendarMonthView month={month()} />);

    fireEvent.click(screen.getByRole("radio", { name: "주" }));

    expect(screen.getAllByRole("gridcell")).toHaveLength(7);
  });

  it("shows the week containing the selected day", () => {
    render(<CalendarMonthView month={month()} />);

    // 8월 9일은 그리드 두 번째 주(인덱스 7..13)에 있다.
    fireEvent.click(screen.getByLabelText(/8월 9일/));
    fireEvent.click(screen.getByRole("radio", { name: "주" }));

    expect(screen.getByLabelText(/8월 8일/)).toBeTruthy();
    expect(screen.getByLabelText(/8월 14일/)).toBeTruthy();
    expect(screen.queryByLabelText(/8월 1일/)).toBeNull();
  });
```

- [ ] **Step 10: 실패 확인**

Run: `npx vitest run tests/unit/calendar-month-view.test.tsx`
Expected: FAIL — `Unable to find an accessible element with the role "radiogroup" and name "보기 방식"`

- [ ] **Step 11: `CalendarMonthView`에 주간 뷰 추가**

주간 뷰는 이미 로드된 42칸에서 한 주를 잘라내는 순수한 클라이언트 동작이다. 그리드가 이웃 달 날짜까지 포함하므로 이 달에 걸친 어떤 주든 추가 조회 없이 보여줄 수 있다. 서버 왕복이 없으므로 `?w=` 쿼리도 두지 않는다.

`CalendarMonthView.tsx`에 다음을 반영한다.

1. import 추가:

```tsx
import { Segmented } from "@/components/ui/Segmented";
```

2. 상태 추가:

```tsx
  const [view, setView] = useState<"month" | "week">("month");
```

3. 보여줄 칸 계산. 선택된 날짜가 없으면 오늘이 든 주를, 그것도 없으면 첫 주를 보여준다.

```tsx
  // 주간 뷰는 42칸에서 한 주(7칸)를 잘라낼 뿐이라 추가 조회가 필요 없다.
  const anchorDate = selectedDate ?? month.cells.find((cell) => cell.isToday)?.date;
  const anchorIndex = anchorDate ? month.cells.findIndex((cell) => cell.date === anchorDate) : 0;
  const weekStart = Math.floor(Math.max(0, anchorIndex) / 7) * 7;
  const visibleCells = view === "week" ? month.cells.slice(weekStart, weekStart + 7) : month.cells;
```

4. 헤더의 월 이동 `<div>` 옆에 토글을 둔다. 월 이동 블록을 감싼 `flex items-center justify-between` div의 닫는 태그 직전에 추가한다.

```tsx
          <Segmented
            label="보기 방식"
            options={[
              { value: "month", label: "월" },
              { value: "week", label: "주" },
            ]}
            value={view}
            onChange={(next) => setView(next === "week" ? "week" : "month")}
          />
```

5. `CalendarGrid`에 `visibleCells`를 넘긴다.

```tsx
          <CalendarGrid cells={visibleCells} selectedDate={selectedDate} onSelect={setSelectedDate} />
```

`CalendarGrid`는 `cells.length / 7`로 주 수를 계산하므로 7칸을 받으면 한 줄만 그린다. 별도 수정이 필요 없다.

- [ ] **Step 12: 테스트 통과 확인**

Run: `npx vitest run tests/unit/calendar-month-view.test.tsx`
Expected: PASS (11건)

- [ ] **Step 13: 전체 게이트**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: 통과. `quick-entry-form.test.tsx`가 `showDetails` 기본값 변경으로 깨질 수 있다 — `defaultDate`를 넘기지 않으면 기존과 동일하게 접힌 채 시작하므로 통과해야 한다.

- [ ] **Step 14: 개발 서버로 눈으로 확인**

Run: `npm run dev` 후 브라우저에서 `/calendar` 방문
Expected: 달력이 렌더되고, 월 이동 시 URL에 `?ym=`이 붙고 뒤로가기가 동작하며, 날짜를 클릭하면 시트가 열리고, 월/주 토글이 동작한다. 확인 후 서버를 종료한다.

- [ ] **Step 15: 커밋**

```bash
git add src/app/\(app\)/\(shell\)/calendar src/components/calendar src/components/transactions/QuickEntryForm.tsx "src/app/(app)/(shell)/transactions/new/page.tsx" tests/unit/calendar-month-view.test.tsx
git commit -m "feat: add the calendar page with a day detail sheet"
```

---

## Task 14: 홈 리디자인과 달력 스트립

**Files:**
- Create: `src/components/calendar/CalendarStrip.tsx`
- Modify: `src/server/dashboard/service.ts`
- Modify: `src/server/dashboard/index.ts`
- Modify: `src/components/dashboard/DashboardOverview.tsx`
- Modify: `tests/unit/dashboard-overview.test.tsx`
- Modify: `tests/unit/dashboard-service.test.ts`
- Test: `tests/unit/calendar-strip.test.tsx`

**Interfaces:**
- Consumes: `StatTile`, `Card`, `Stagger`, `Sparkline`, `getCalendarMonthForCurrentUser`, `CalendarCell`
- Produces:
  - `DashboardData`에 `recentDays: readonly DashboardDay[]` 추가. `DashboardDay`는 **Task 9의 `src/domain/calendar/types.ts`에 이미 정의되어 있다.** 새로 선언하지 않고 그곳에서 import한다.
  - `CalendarStrip`: `({ days: readonly DashboardDay[] })`

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// tests/unit/calendar-strip.test.tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CalendarStrip } from "@/components/calendar/CalendarStrip";

afterEach(cleanup);

const DAYS = [
  { date: "2026-08-10", income: 0, expense: 12_000, heatLevel: 1 as const },
  { date: "2026-08-11", income: 0, expense: 0, heatLevel: 0 as const },
  { date: "2026-08-12", income: 2_500_000, expense: 47_000, heatLevel: 4 as const },
];

describe("CalendarStrip", () => {
  it("links through to the calendar page", () => {
    render(<CalendarStrip days={DAYS} />);

    expect(screen.getByRole("link", { name: /달력/ }).getAttribute("href")).toBe("/calendar");
  });

  it("renders one marker per day", () => {
    const { container } = render(<CalendarStrip days={DAYS} />);

    expect(container.querySelectorAll("[data-strip-day]")).toHaveLength(3);
  });

  it("describes each day as text rather than colour alone", () => {
    render(<CalendarStrip days={DAYS} />);

    expect(screen.getByTitle("8월 12일 지출 47,000원")).toBeTruthy();
    expect(screen.getByTitle("8월 11일 지출 없음")).toBeTruthy();
  });

  it("renders nothing when there are no days", () => {
    const { container } = render(<CalendarStrip days={[]} />);

    expect(container.querySelectorAll("[data-strip-day]")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/calendar-strip.test.tsx`
Expected: FAIL — `Cannot find module '@/components/calendar/CalendarStrip'`

- [ ] **Step 3: `CalendarStrip.tsx` 작성**

```tsx
// src/components/calendar/CalendarStrip.tsx
import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { cx } from "@/components/ui/cx";
import type { DashboardDay, HeatLevel } from "@/domain/calendar/types";

const HEAT_CLASSES: Record<HeatLevel, string> = {
  0: "bg-border-subtle",
  1: "bg-brand-500/25",
  2: "bg-brand-500/45",
  3: "bg-brand-500/70",
  4: "bg-brand-500",
};

function describe(day: DashboardDay): string {
  const [, month, date] = day.date.split("-").map(Number);
  const spend = day.expense > 0 ? `지출 ${day.expense.toLocaleString("ko-KR")}원` : "지출 없음";
  return `${month}월 ${date}일 ${spend}`;
}

export function CalendarStrip({ days }: Readonly<{ days: readonly DashboardDay[] }>) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-content-primary">최근 2주</h2>
        <Link href="/calendar" className="text-xs font-semibold text-brand-600 no-underline dark:text-brand-400">
          달력에서 보기
        </Link>
      </div>
      <div className="flex items-end gap-1">
        {days.map((day) => (
          <div
            key={day.date}
            data-strip-day={day.date}
            title={describe(day)}
            className={cx("h-8 flex-1 rounded-sm", HEAT_CLASSES[day.heatLevel])}
          />
        ))}
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/unit/calendar-strip.test.tsx`
Expected: PASS (4건)

- [ ] **Step 5: `DashboardData`에 `recentDays` 추가**

`src/server/dashboard/service.ts`의 `DashboardData` 타입에 필드를 추가한다.

```ts
import type { DashboardDay } from "@/domain/calendar/types";

export type DashboardData = Readonly<{
  freeSpendable: number;
  dailySpendable: number;
  liquidAssets: number;
  netWorth: number;
  cardOutstanding: number;
  income: number;
  expense: number;
  budgetUsage: number;
  savingsGoals: number;
  upcomingEvents: number;
  /** 최근 14일 히트 스트립. 오늘이 마지막 원소다. */
  recentDays: readonly DashboardDay[];
}>;
```

- [ ] **Step 6: `dashboard/index.ts`에서 최근 14일 계산**

기존 `getDashboardOverviewForCurrentUser`에 다음을 추가한다. 이미 `listTransactionsForCurrentUser()`로 전 거래를 가져오고 있으므로 추가 조회 없이 계산할 수 있다.

```ts
import { aggregateDailyTotals, heatLevels } from "@/domain/calendar/month";
import { addIsoDays, todayInSeoul } from "@/lib/dates/seoul";

// ... 기존 코드 안에서 ...
const seoulToday = todayInSeoul();
const stripStart = addIsoDays(seoulToday, -13);
const stripTotals = aggregateDailyTotals(
  transactions.map((row) => ({
    id: row.id,
    type: row.type,
    status: "CONFIRMED" as const,
    transactionAt: row.transactionAt,
    baseAmount: row.baseAmount,
  })),
);
const stripLevels = heatLevels(new Map([...stripTotals].map(([date, value]) => [date, value.expense])));
const recentDays = Array.from({ length: 14 }, (_, index) => {
  const date = addIsoDays(stripStart, index);
  const totals = stripTotals.get(date) ?? { income: 0, expense: 0 };
  return { date, income: totals.income, expense: totals.expense, heatLevel: stripLevels.get(date) ?? 0 };
});
```

`listTransactionsForCurrentUser()`가 반환하는 `TransactionRecord`에는 `status`가 없다. 리스트 조회는 이미 사용자 소유 거래 전체를 주므로 여기서는 `CONFIRMED`로 간주하되, **정확성을 위해** `aggregateDailyTotals`에 넘기기 전에 상태를 확인할 수 없다는 점을 주석으로 남기고, 대신 `getCalendarMonthForCurrentUser`와 같은 경로를 쓰고 싶다면 Task 11의 리포지토리를 재사용한다. 이 태스크에서는 기존 `listTransactionsForCurrentUser`를 그대로 쓰고, 반환 객체에 `recentDays`를 넣는다.

- [ ] **Step 7: `dashboard-service.test.ts` 갱신**

기존 테스트가 `DashboardData`를 통째로 만들고 있다면 `recentDays: []`를 추가한다. 기존 단언은 건드리지 않는다.

- [ ] **Step 8: `DashboardOverview.tsx` 재작성**

```tsx
// src/components/dashboard/DashboardOverview.tsx
import { CalendarStrip } from "@/components/calendar/CalendarStrip";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sparkline } from "@/components/ui/Sparkline";
import { StatTile } from "@/components/ui/StatTile";
import type { DashboardData } from "@/server/dashboard/service";

const won = (value: number) => `${value.toLocaleString("ko-KR")}원`;

export function DashboardOverview({ overview }: Readonly<{ overview: DashboardData }>) {
  const spendTrend = overview.recentDays.map((day) => day.expense);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="대시보드" />

      {/* 히어로: 가장 큰 숫자 둘. 그라디언트는 여기에만 쓴다. */}
      <Card variant="gradient" className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <h2 className="text-sm font-medium text-white/80">여유 지출액</h2>
            <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">{won(overview.freeSpendable)}</p>
          </div>
          <div>
            <h2 className="text-sm font-medium text-white/80">일일 지출 가능액</h2>
            <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">{won(overview.dailySpendable)}</p>
          </div>
        </div>
        {spendTrend.length > 0 ? (
          <div className="text-white/70">
            <Sparkline values={spendTrend} label={`최근 ${spendTrend.length}일 지출 추세`} />
          </div>
        ) : null}
      </Card>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="수입" value={won(overview.income)} tone="positive" />
        <StatTile label="지출" value={won(overview.expense)} />
        <StatTile label="예산 사용액" value={won(overview.budgetUsage)} />
        <StatTile label="유동 자산" value={won(overview.liquidAssets)} />
        <StatTile label="순자산" value={won(overview.netWorth)} />
        <StatTile label="카드 미결제액" value={won(overview.cardOutstanding)} />
      </section>

      <CalendarStrip days={overview.recentDays} />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-sm font-semibold text-content-primary">저축 목표 {overview.savingsGoals}개</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-content-primary">예정된 일정 {overview.upcomingEvents}건</p>
        </Card>
      </section>
    </div>
  );
}
```

- [ ] **Step 9: `dashboard-overview.test.tsx` 갱신**

기존 3개 단언(`여유 지출액`, `450,000`, `예정된 일정 3건`)은 그대로 통과해야 한다. `overview` 객체에 `recentDays: []`만 추가한다. 그리고 아래 단언을 추가한다.

```tsx
    expect(screen.getByText("수입")).toBeTruthy();
    expect(screen.getByText("3,000,000원")).toBeTruthy();
```

- [ ] **Step 10: 전체 게이트**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: 통과

- [ ] **Step 11: 커밋**

```bash
git add src/components/calendar/CalendarStrip.tsx src/components/dashboard src/server/dashboard tests/unit/calendar-strip.test.tsx tests/unit/dashboard-overview.test.tsx tests/unit/dashboard-service.test.ts
git commit -m "feat: redesign the dashboard with a hero and calendar strip"
```

---

## Task 15: 거래내역과 통계 레이아웃

**Files:**
- Modify: `src/app/(app)/(shell)/transactions/page.tsx`
- Modify: `src/components/statistics/StatisticsOverview.tsx`
- Test: `tests/unit/transactions-filters.test.tsx`

**Interfaces:**
- Consumes: `Card`, `Button`, `StatTile`, `Sparkline`, `Ring`, Task 1 토큰
- Produces: 거래내역 페이지에 활성 필터 칩과 접이식 필터 영역, 통계 화면에 스파크라인·링

- [ ] **Step 1: 활성 필터 칩 헬퍼의 실패 테스트 작성**

칩 라벨 계산은 순수 함수이므로 도메인에 두고 테스트한다.

```ts
// tests/unit/transactions-filters.test.tsx
import { describe, expect, it } from "vitest";

import { describeActiveFilters } from "@/domain/transactions/filter-summary";

describe("describeActiveFilters", () => {
  it("returns nothing when no filter is applied", () => {
    expect(describeActiveFilters({}, { accounts: [], categories: [], tags: [] })).toEqual([]);
  });

  it("describes a date range", () => {
    expect(
      describeActiveFilters({ from: "2026-08-01", to: "2026-08-31" }, { accounts: [], categories: [], tags: [] }),
    ).toEqual([{ key: "period", label: "2026-08-01 ~ 2026-08-31" }]);
  });

  it("describes an open-ended date range", () => {
    expect(describeActiveFilters({ from: "2026-08-01" }, { accounts: [], categories: [], tags: [] })).toEqual([
      { key: "period", label: "2026-08-01 이후" },
    ]);
  });

  it("resolves an account id to its name", () => {
    expect(
      describeActiveFilters({ accountId: "a1" }, { accounts: [{ id: "a1", name: "국민카드" }], categories: [], tags: [] }),
    ).toEqual([{ key: "accountId", label: "국민카드" }]);
  });

  it("falls back gracefully when the id is unknown", () => {
    expect(describeActiveFilters({ categoryId: "gone" }, { accounts: [], categories: [], tags: [] })).toEqual([
      { key: "categoryId", label: "카테고리" },
    ]);
  });

  it("describes an amount range", () => {
    expect(describeActiveFilters({ minAmount: 10_000, maxAmount: 50_000 }, { accounts: [], categories: [], tags: [] })).toEqual([
      { key: "amount", label: "10,000원 ~ 50,000원" },
    ]);
  });

  it("describes a memo search", () => {
    expect(describeActiveFilters({ memo: "커피" }, { accounts: [], categories: [], tags: [] })).toEqual([
      { key: "memo", label: '메모 "커피"' },
    ]);
  });

  it("describes the transaction type in Korean", () => {
    expect(describeActiveFilters({ type: "EXPENSE" }, { accounts: [], categories: [], tags: [] })).toEqual([
      { key: "type", label: "지출" },
    ]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/transactions-filters.test.tsx`
Expected: FAIL — `Cannot find module '@/domain/transactions/filter-summary'`

- [ ] **Step 3: `filter-summary.ts` 작성**

```ts
// src/domain/transactions/filter-summary.ts
export type FilterValues = Readonly<{
  from?: string;
  to?: string;
  type?: "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT";
  status?: "PENDING" | "CONFIRMED" | "CANCELLED";
  accountId?: string;
  categoryId?: string;
  tagId?: string;
  minAmount?: number;
  maxAmount?: number;
  memo?: string;
}>;

export type NamedOption = Readonly<{ id: string; name: string }>;

export type FilterLookups = Readonly<{
  accounts: readonly NamedOption[];
  categories: readonly NamedOption[];
  tags: readonly NamedOption[];
}>;

export type FilterChip = Readonly<{ key: string; label: string }>;

const TYPE_LABELS = { INCOME: "수입", EXPENSE: "지출", TRANSFER: "이체", ADJUSTMENT: "조정" } as const;
const STATUS_LABELS = { PENDING: "대기", CONFIRMED: "확정", CANCELLED: "취소" } as const;

const won = (value: number) => `${value.toLocaleString("ko-KR")}원`;
const nameOf = (options: readonly NamedOption[], id: string, fallback: string) =>
  options.find((option) => option.id === id)?.name ?? fallback;

/** 적용 중인 필터를 사람이 읽을 수 있는 칩 목록으로 바꾼다. */
export function describeActiveFilters(values: FilterValues, lookups: FilterLookups): FilterChip[] {
  const chips: FilterChip[] = [];

  if (values.from && values.to) chips.push({ key: "period", label: `${values.from} ~ ${values.to}` });
  else if (values.from) chips.push({ key: "period", label: `${values.from} 이후` });
  else if (values.to) chips.push({ key: "period", label: `${values.to} 이전` });

  if (values.type) chips.push({ key: "type", label: TYPE_LABELS[values.type] });
  if (values.status) chips.push({ key: "status", label: STATUS_LABELS[values.status] });
  if (values.accountId) chips.push({ key: "accountId", label: nameOf(lookups.accounts, values.accountId, "계좌/카드") });
  if (values.categoryId) chips.push({ key: "categoryId", label: nameOf(lookups.categories, values.categoryId, "카테고리") });
  if (values.tagId) chips.push({ key: "tagId", label: nameOf(lookups.tags, values.tagId, "태그") });

  if (values.minAmount !== undefined && values.maxAmount !== undefined) {
    chips.push({ key: "amount", label: `${won(values.minAmount)} ~ ${won(values.maxAmount)}` });
  } else if (values.minAmount !== undefined) {
    chips.push({ key: "amount", label: `${won(values.minAmount)} 이상` });
  } else if (values.maxAmount !== undefined) {
    chips.push({ key: "amount", label: `${won(values.maxAmount)} 이하` });
  }

  if (values.memo) chips.push({ key: "memo", label: `메모 "${values.memo}"` });

  return chips;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/unit/transactions-filters.test.tsx`
Expected: PASS (8건)

- [ ] **Step 5: 거래내역 페이지에 접이식 필터와 칩 적용**

`src/app/(app)/(shell)/transactions/page.tsx`를 수정한다.

1. `describeActiveFilters`를 import하고 `filters`와 조회한 `accounts`/`categories`/`tags`로 칩을 만든다.
2. 필터 `<form>`을 `<details>`로 감싼다. 활성 필터가 있으면 `open` 속성을 준다.
3. 칩을 `<details>` 바깥 위쪽에 렌더한다.
4. 상단 액션에 `달력으로 보기` 링크(`/calendar`)를 추가한다.
5. 표 안의 `text-slate-*` / `bg-white` / `border-slate-*` 클래스를 Task 3의 매핑대로 토큰으로 바꾼다. `amountColor` 함수의 반환값도 `text-positive-700` → `text-positive-600 dark:text-positive-500`, `text-slate-900` → `text-content-primary`, `text-slate-500` → `text-content-muted`로 바꾼다.
6. `secondaryLinkClasses` 상수를 토큰 기반으로 바꾼다.

```tsx
const secondaryLinkClasses =
  "inline-flex items-center justify-center gap-1.5 rounded-tile border border-border-strong bg-surface-raised px-4 py-2 text-sm font-semibold text-content-primary no-underline shadow-card transition-colors hover:bg-surface-base";
```

칩 마크업:

```tsx
      {activeFilters.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-content-secondary">적용된 필터</span>
          {activeFilters.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center rounded-pill bg-brand-500/12 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:text-brand-300"
            >
              {chip.label}
            </span>
          ))}
          <Link href="/transactions" className="text-xs font-semibold text-content-muted no-underline hover:text-content-primary">
            모두 지우기
          </Link>
        </div>
      ) : null}
```

`<details>` 래퍼:

```tsx
      <Card>
        <details open={activeFilters.length > 0}>
          <summary className="cursor-pointer list-none text-sm font-bold text-content-primary">
            검색 조건 {activeFilters.length > 0 ? `(${activeFilters.length})` : ""}
          </summary>
          <form className="mt-4 flex flex-col gap-4">
            {/* 기존 form 내용을 그대로 옮긴다 */}
          </form>
        </details>
      </Card>
```

- [ ] **Step 6: 통계 화면에 시각화 적용**

`src/server/statistics/service.ts`의 `StatisticsOverview`가 이미 다음을 계산해 둔다. **새 계산을 추가하지 않고 이 필드만 쓴다.**

```text
monthly: { key: string; income: number; expense: number; value: number }[]   // 최근 6개월
category / tags / paymentMethods / fixedVariable / weekday / weekOfMonth: { name, amount }[]
monthOverMonth: number | null    // 전월 대비 지출 증감 퍼센트 (정수)
savingsRate: number | null       // 저축률 퍼센트 (정수, 0..100)
netWorthTrend: { month: string; value: number }[]
```

`src/components/statistics/StatisticsOverview.tsx`를 다음 세 곳만 바꾼다.

1. 월별 지출 추세 표 **위에** 스파크라인을 둔다. 숫자 표는 그대로 남긴다 (`UI_UX.md` 10항).

```tsx
        <div className="text-brand-500">
          <Sparkline
            values={overview.monthly.map((point) => point.expense)}
            label={`최근 ${overview.monthly.length}개월 지출 추세`}
          />
        </div>
```

2. 순자산 추세에도 같은 방식으로 스파크라인을 둔다.

```tsx
        <div className="text-positive-600 dark:text-positive-500">
          <Sparkline
            values={overview.netWorthTrend.map((point) => point.value)}
            label={`최근 ${overview.netWorthTrend.length}개월 순자산 추세`}
          />
        </div>
```

3. 저축률은 `null`일 수 있으므로 값이 있을 때만 링을 그린다. `savingsRate`는 퍼센트 정수이므로 100으로 나눠 넘긴다.

```tsx
        {overview.savingsRate === null ? null : (
          <Ring
            ratio={overview.savingsRate / 100}
            label="저축률"
            caption={overview.monthOverMonth === null ? undefined : `전월 대비 지출 ${overview.monthOverMonth}%`}
          />
        )}
```

그리고 파일 전체의 색상 클래스를 Task 3의 매핑대로 토큰으로 치환한다.

- [ ] **Step 7: 전체 게이트**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: 통과

- [ ] **Step 8: 커밋**

```bash
git add src/domain/transactions/filter-summary.ts "src/app/(app)/(shell)/transactions/page.tsx" src/components/statistics tests/unit/transactions-filters.test.tsx
git commit -m "feat: add filter chips to history and visuals to statistics"
```

---

## Task 16: 자산·계획과 나머지 화면

**Files:**
- Modify: `src/domain/cards/outstanding.ts`
- Modify: `tests/unit/credit-card.test.ts`
- Modify: `src/components/assets/AssetOverview.tsx`
- Modify: `src/components/planning/PlanningOverview.tsx`
- Modify: `src/components/export/MarkdownExport.tsx`
- Modify: `src/components/notifications/NotificationCenter.tsx`
- Modify: `src/components/settings/{AdminInviteSettings,BackupRestore,DeleteAccount}.tsx`
- Modify: `src/components/transactions/{EditTransactionForm,PlannedTransactionForm,RecurringRuleForm,DeleteTransactionButton}.tsx`
- Modify: `src/components/assets/ReconciliationForm.tsx`
- Modify: `src/components/planning/{CategoryBudgetForm,MonthlyBudgetForm,SavingsContributionForm,SavingsGoalForm}.tsx`
- Modify: `src/app/(app)/(shell)/{assets,export,more,notifications,plans,settings,statistics}/page.tsx`
- Modify: `src/app/(app)/onboarding/page.tsx`
- Modify: `src/app/(public)/invite/page.tsx`
- Modify: `src/app/page.tsx`
- Modify: 깨지는 기존 테스트

**Interfaces:**
- Consumes: 앞선 모든 프리미티브
- Produces: `creditUsageRatio(outstanding: number, availableLimit: number | null): number | null` (`src/domain/cards/outstanding.ts`), 그리고 전 화면이 같은 토큰과 프리미티브를 쓴다

- [ ] **Step 1: 남은 하드코딩 색상을 전수 조사**

Run: `grep -rn "slate-\|bg-white\|rounded-xl\|rounded-lg" src --include=*.tsx | grep -v "src/components/ui/" | wc -l`
Expected: 남은 개수가 출력된다. 이 숫자를 0에 가깝게 줄이는 것이 이 태스크의 목표다.

Run: `grep -rln "slate-\|bg-white" src --include=*.tsx | grep -v "src/components/ui/"`
Expected: 처리해야 할 파일 목록

- [ ] **Step 2: 카드 한도 사용률을 도메인 함수로 추가**

`AssetOverview`의 카드는 `{ id, name, outstanding, availableLimit: number | null, nextPaymentDate, installmentSchedule }`를 갖는다. 한도 사용률은 아직 계산되어 있지 않다. **컴포넌트에서 나누지 말고** 도메인에 넣는다 (`AGENTS.md` 3항).

먼저 실패하는 테스트를 `tests/unit/credit-card.test.ts`에 추가한다.

```ts
import { creditUsageRatio } from "@/domain/cards/outstanding";

describe("creditUsageRatio", () => {
  it("divides the outstanding balance by the total limit", () => {
    // 미결제 30만, 남은 한도 70만 → 총 한도 100만의 30%
    expect(creditUsageRatio(300_000, 700_000)).toBe(0.3);
  });

  it("returns null when the limit is unknown", () => {
    expect(creditUsageRatio(300_000, null)).toBeNull();
  });

  it("returns null when the total limit is zero", () => {
    expect(creditUsageRatio(0, 0)).toBeNull();
  });

  it("reports a fully used card as 1", () => {
    expect(creditUsageRatio(500_000, 0)).toBe(1);
  });
});
```

Run: `npx vitest run tests/unit/credit-card.test.ts`
Expected: FAIL — `creditUsageRatio is not a function`

`src/domain/cards/outstanding.ts`에 추가한다.

```ts
/**
 * 카드 한도 사용률(0..1). availableLimit이 null이면 한도를 모르므로 null을 반환한다.
 * 금융 수치를 모른다는 사실을 0으로 조용히 대체하지 않는다 (UI_UX.md 13항).
 */
export function creditUsageRatio(outstanding: number, availableLimit: number | null): number | null {
  if (availableLimit === null) return null;
  const total = outstanding + availableLimit;
  if (total <= 0) return null;
  return outstanding / total;
}
```

Run: `npx vitest run tests/unit/credit-card.test.ts`
Expected: PASS

- [ ] **Step 3: 자산 화면 재구성**

`src/components/assets/AssetOverview.tsx`에서:

1. 요약 `Card`를 `variant="gradient"` 히어로로 바꾸고 순자산을 가장 큰 숫자로 올린다.

```tsx
        <Card variant="gradient">
          <h2 className="text-sm font-medium text-white/80">순자산</h2>
          <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">{format(overview.netWorth)}원</p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-white/20 pt-3 text-sm text-white/80">
            <p>유동 자산 {format(overview.liquidAssets)}원</p>
            <p>부채 {format(overview.liabilities)}원</p>
          </div>
        </Card>
```

2. 신용카드 `Card`에 한도 사용률 링을 붙인다. `availableLimit`이 `null`이면 링을 그리지 않는다.

```tsx
import { creditUsageRatio } from "@/domain/cards/outstanding";
// ...
                {(() => {
                  const ratio = creditUsageRatio(card.outstanding, card.availableLimit);
                  return ratio === null ? null : (
                    <Ring ratio={ratio} label="한도 사용률" caption={`남은 한도 ${format(card.availableLimit ?? 0)}원`} />
                  );
                })()}
```

3. 그룹 제목의 `text-slate-500 dark:text-slate-400`를 `text-content-muted`로, 계좌 카드 안의 `text-slate-900 dark:text-slate-100`을 `text-content-primary`로 바꾼다. 카드의 어두운 그라디언트(`from-slate-900 to-slate-800`)는 신용카드를 시각적으로 구분하는 의도적 선택이므로 **그대로 둔다.**

- [ ] **Step 4: 계획 화면에 Segmented 탭 적용**

`PlanningOverview.tsx`를 `"use client"`로 만들고 `Segmented`로 예산 / 저축 목표 / 미래 현금흐름 세 섹션을 전환한다. 각 섹션의 내용과 폼은 그대로 옮긴다. 현금흐름 목록은 확정과 예정을 각각 실선/점선 테두리로 구분한다.

계산 로직은 이미 `server/planning`에 있으므로 컴포넌트에서 새로 만들지 않는다.

- [ ] **Step 5: 나머지 화면 색상 치환**

Step 1에서 나온 파일들에 Task 3의 매핑을 적용한다. 구조는 바꾸지 않는다. `PageHeader`, `Card`, `Button`, `TextField`, `Select`를 이미 쓰고 있는 곳은 대부분 자동으로 좋아진다.

- [ ] **Step 6: 깨진 테스트 갱신**

Run: `npm run test`
Expected: 실패 목록을 확인한다. 각 실패에 대해:

- 마크업/클래스 변경 때문이면 기대값만 새 구조에 맞게 고친다.
- 재정 계산 단언이 깨졌다면 **구현이 잘못된 것이다.** 테스트를 고치지 말고 구현을 고친다.
- 어느 쪽인지 판단이 서지 않으면 멈추고 보고한다.

- [ ] **Step 7: 전체 게이트**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: 전부 통과

- [ ] **Step 8: 하드코딩 색상 잔여 확인**

Run: `grep -rn "slate-\|bg-white" src --include=*.tsx | grep -v "src/components/ui/"`
Expected: 남은 항목은 `AssetOverview.tsx`의 신용카드 어두운 그라디언트뿐이다. 그 외가 남았다면 치환한다.

- [ ] **Step 9: 커밋**

```bash
git add src tests
git commit -m "feat: apply the design system across the remaining screens"
```

---

## Task 17: E2E 검증과 문서 갱신

**Files:**
- Create: `tests/e2e/calendar.spec.ts`
- Modify: `docs/UI_UX.md`

**Interfaces:**
- Consumes: `createE2EUser`, `deleteE2EUser`, `signInAsE2EUser`
- Produces: 달력 임계 경로 E2E 1건

- [ ] **Step 1: E2E 테스트 작성**

```ts
// tests/e2e/calendar.spec.ts
import { expect, test } from "@playwright/test";

import { createE2EUser, deleteE2EUser, signInAsE2EUser, type E2EUser } from "./support/test-user";

let user: E2EUser;

test.afterEach(async () => {
  if (user) await deleteE2EUser(user);
});

test.describe("critical path: calendar", () => {
  test("a recorded expense shows on the calendar and opens in the day sheet", async ({ page }) => {
    user = await createE2EUser("calendar");
    await signInAsE2EUser(page, user);

    await page.goto("/onboarding");
    await page.getByLabel("이름", { exact: true }).fill("E2E Calendar User");
    await page.getByLabel("급여일").fill("1");
    await page.getByLabel("첫 은행 계좌").fill("E2E Calendar Bank");
    await page.getByLabel("현재 잔액").fill("1000000");
    await page.getByRole("button", { name: "시작하기" }).click();
    await expect(page).toHaveURL("/home");

    await page.goto("/transactions/new");
    await page.getByLabel("금액").fill("47000");
    await page.getByRole("button", { name: /상세 옵션/ }).click();
    await page.getByLabel("메모").fill("E2E 점심");
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByText("저장했습니다.")).toBeVisible();

    await page.goto("/calendar");
    await expect(page.getByRole("grid", { name: "월별 기록" })).toBeVisible();

    // 오늘 칸에 지출이 반영되어야 한다.
    await expect(page.getByText("-47,000").first()).toBeVisible();

    const previousMonthUrl = await page.getByRole("link", { name: "이전 달" }).getAttribute("href");
    await page.getByRole("link", { name: "이전 달" }).click();
    await expect(page).toHaveURL(previousMonthUrl ?? /ym=/);

    await page.goBack();
    await expect(page.getByRole("grid", { name: "월별 기록" })).toBeVisible();

    await page.getByText("-47,000").first().click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("E2E 점심")).toBeVisible();
    await expect(sheet.getByRole("link", { name: "이 날짜로 기록" })).toBeVisible();
  });
});
```

- [ ] **Step 2: E2E 실행**

Run: `npm run test:e2e -- tests/e2e/calendar.spec.ts`
Expected: PASS

실패하면 셀렉터를 실제 마크업에 맞게 고친다. 온보딩 라벨 문구가 다르면 `tests/e2e/planning.spec.ts`의 동작하는 값을 그대로 쓴다.

- [ ] **Step 3: 전체 E2E**

Run: `npm run test:e2e`
Expected: 기존 스펙 전부 통과. 셸/폼 변경으로 셀렉터가 깨진 스펙이 있으면 셀렉터만 고치고 **검증 의도는 유지**한다.

- [ ] **Step 4: `UI_UX.md`에 새 사실을 반영**

다음 세 곳을 갱신한다.

1. 2장 모바일 Bottom Navigation:

```text
홈 | 내역 | + 입력 | 달력 | 더보기
```

2. 2장 데스크톱 Sidebar에 `달력`을 `거래내역` 아래에 추가한다.

3. 새 장을 추가한다.

```markdown
# 16. 달력

월간 그리드(6주 42칸)로 자신의 기록을 회고한다.

셀 표시:

- 날짜 숫자 (오늘은 필 배경, 이웃 달은 흐리게)
- 수입이 있는 날만 초록 윗줄 `+금액`
- 지출이 있는 날은 아랫줄 `-금액`
- 배경은 지출 강도 히트맵 0–4단계 (분위수 기준)
- 예정 항목이 있으면 점선 하단 보더와 건수

확정과 예정을 시각적으로 구분한다. 예정 거래, 카드 결제일, 반복 고정비는
표시만 하고 수입/지출 합계에는 넣지 않는다.

날짜를 선택하면 시트가 열리고 그날의 확정 거래와 예정 항목을 각각의
섹션으로 보여준다. `이 날짜로 기록` 버튼이 해당 날짜가 채워진 입력
화면으로 보낸다.

접근성: 그리드는 `role="grid"`이며 방향키로 이동하고 Enter로 상세를 연다.
각 셀의 `aria-label`이 날짜·수입·지출·예정 건수를 텍스트로 전달하므로
히트맵 색과 점선에만 의존하지 않는다.

URL은 `?ym=YYYY-MM`을 쓴다. 뒤로가기, 새로고침, 링크 공유가 모두 동작한다.
```

- [ ] **Step 5: 전체 게이트**

Run: `npm run typecheck && npm run lint && npm run test && npm run test:e2e`
Expected: 전부 통과

- [ ] **Step 6: 커밋**

```bash
git add tests/e2e/calendar.spec.ts docs/UI_UX.md
git commit -m "test: cover the calendar critical path and document the view"
```
