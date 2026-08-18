# 소비 성격 분류 및 소비 여력 분석 고도화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 거래별 사용자 지정 소비 성격(정기/일회성/비정기/예외적/미분류)을 도입하고, 월간 통계·AI Export에 소비 구조(총/예외/일회성/평소/조정), 지출 집중도, 근거리·장기 확정 현금흐름 분리, Safe-to-Spend(사용 가능 금액)를 추가한다.

**Architecture:** DB에 `transactions.expense_nature_user`/`expense_nature_source`와 `profiles.emergency_fund_amount`를 추가한다. 기존 파생 함수(`classifyExpenseNature`)는 그대로 두고 그 위에 `resolveExpenseNature()`를 얹어 사용자 지정값을 우선한다. 소비 구조/집중도/현금흐름 horizon 계산은 순수 도메인 함수로 작성해 통계 화면과 AI Export가 동일 함수를 호출한다. 기존 `calculateFreeSpendable()`은 유지하되, 새 `splitDeductionsByHorizon()`으로 "다음 급여일 이전/이후" 현금유출을 분리하고 비상금을 뺀 Safe-to-Spend 함수를 추가한다.

**Tech Stack:** Next.js Server Actions, Supabase(Postgres + RLS), TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-18-spending-nature-analysis-design.md`

## Global Constraints

- 기존 회계 원칙(계좌 간 이체 제외, 카드대금 납부는 소비 아님, 할부 회차는 미래 현금흐름, 예정 거래는 소비 아님, 잔액조정 제외)은 변경하지 않는다.
- 공식 월 지출(수입/지출 합계) 금액 자체는 이번 작업으로 바뀌지 않는다. 새 지표는 모두 별도 필드로 추가한다.
- 금액은 정수 KRW 기준(`Number.isSafeInteger`)을 유지한다.
- 값이 존재하지 않는 항목(급여일/비상금 미설정 등)은 `0`으로 채우지 않고 필드 자체를 생략하거나 `null`로 명시한다.
- 화면 통계와 AI Export는 같은 도메인 함수를 호출해야 하며, 집계 로직을 두 곳에 따로 작성하지 않는다.
- 기존 거래 데이터는 마이그레이션으로 손실되거나 임의로 소급 분류되지 않는다(`expense_nature_source` 기본값 `UNSET`).
- 신규 컬럼/테이블도 기존 `user_owned_rows` RLS 패턴을 그대로 적용한다.

---

### Task 1: DB Migration — 소비 성격 컬럼과 비상금 컬럼 추가

**Files:**
- Create: `supabase/migrations/20260818090000_expense_nature_and_emergency_fund.sql`
- Test: `tests/integration/rls-security-suite.test.ts` (기존 파일에 신규 컬럼 케이스 추가)

**Interfaces:**
- Produces: `public.transaction_expense_nature` enum, `transactions.expense_nature_user` (nullable enum), `transactions.expense_nature_source` (text, default `'UNSET'`), `profiles.emergency_fund_amount` (integer, nullable).

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
create type public.transaction_expense_nature as enum (
  'RECURRING', 'ONE_TIME', 'IRREGULAR', 'EXCEPTIONAL', 'UNKNOWN'
);

alter table public.transactions
  add column expense_nature_user public.transaction_expense_nature,
  add column expense_nature_source text not null default 'UNSET'
    check (expense_nature_source in ('UNSET', 'MANUAL', 'SUGGESTED'));

-- UNSET은 값이 없어야 하고, MANUAL/SUGGESTED는 값이 있어야 한다.
alter table public.transactions
  add constraint transactions_expense_nature_source_consistency check (
    (expense_nature_source = 'UNSET' and expense_nature_user is null)
    or (expense_nature_source <> 'UNSET' and expense_nature_user is not null)
  );

alter table public.profiles
  add column emergency_fund_amount numeric(18, 2)
    constraint profiles_emergency_fund_amount_nonnegative check (
      emergency_fund_amount is null or emergency_fund_amount >= 0
    );
```

- [ ] **Step 2: 로컬 Supabase에 마이그레이션 적용**

Run: `supabase db reset` (로컬 개발 DB 기준. 원격 적용은 팀 배포 절차를 따른다.)
Expected: 에러 없이 완료, `transactions`/`profiles` 테이블에 신규 컬럼 확인.

- [ ] **Step 3: RLS 회귀 확인**

`tests/integration/rls-security-suite.test.ts`를 열어 기존에 `transactions`/`profiles` 컬럼을 select/insert하는 테스트가 신규 컬럼이 있어도 그대로 통과하는지 실행한다.

Run: `npm run test:integration -- rls-security-suite`
Expected: PASS (기존 `user_owned_rows` 정책이 테이블 단위로 적용되므로 신규 컬럼도 자동으로 격리됨 — 정책 변경 불필요).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260818090000_expense_nature_and_emergency_fund.sql
git commit -m "feat: add expense nature and emergency fund columns"
```

---

### Task 2: 도메인 — `resolveExpenseNature()` 추가

**Files:**
- Modify: `src/domain/export/expense-nature.ts`
- Test: `tests/unit/expense-nature.test.ts` (신규)

**Interfaces:**
- Consumes: 없음 (순수 함수).
- Produces: `export type ResolvedExpenseNature = "RECURRING" | "ONE_TIME" | "IRREGULAR" | "EXCEPTIONAL" | "UNKNOWN"`, `export type ExpenseNatureSource = "UNSET" | "MANUAL" | "SUGGESTED"`, `export function resolveExpenseNature(transaction: Readonly<{ recurringRuleId?: string; plannedTransactionId?: string; expenseNatureUser?: ResolvedExpenseNature; expenseNatureSource?: ExpenseNatureSource }>): ResolvedExpenseNature`. 이후 Task에서 이 함수가 `classifyExpenseNature`의 유일한 소비처가 된다.

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// tests/unit/expense-nature.test.ts
import { describe, expect, it } from "vitest";
import { resolveExpenseNature } from "@/domain/export/expense-nature";

describe("resolveExpenseNature", () => {
  it("사용자가 MANUAL로 지정한 값을 파생값보다 우선한다", () => {
    expect(resolveExpenseNature({
      recurringRuleId: "rule-1",
      expenseNatureUser: "EXCEPTIONAL",
      expenseNatureSource: "MANUAL",
    })).toBe("EXCEPTIONAL");
  });

  it("UNSET이면 반복 거래 규칙 기반 파생값을 사용한다", () => {
    expect(resolveExpenseNature({ recurringRuleId: "rule-1", expenseNatureSource: "UNSET" })).toBe("RECURRING");
  });

  it("UNSET이면 예정 거래 기반 파생값을 사용한다", () => {
    expect(resolveExpenseNature({ plannedTransactionId: "planned-1", expenseNatureSource: "UNSET" })).toBe("ONE_TIME");
  });

  it("소스 정보가 아예 없으면 UNSET과 동일하게 파생 로직을 사용한다", () => {
    expect(resolveExpenseNature({})).toBe("UNKNOWN");
  });

  it("MANUAL이지만 값이 없으면(비정상 데이터) 파생 로직으로 안전하게 대체한다", () => {
    expect(resolveExpenseNature({ expenseNatureSource: "MANUAL", recurringRuleId: "rule-1" })).toBe("RECURRING");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/unit/expense-nature.test.ts`
Expected: FAIL — `resolveExpenseNature is not exported`.

- [ ] **Step 3: 구현**

`src/domain/export/expense-nature.ts` 끝에 추가:

```typescript
export type ExpenseNatureSource = "UNSET" | "MANUAL" | "SUGGESTED";
export type ResolvedExpenseNature = ExpenseNature | "IRREGULAR" | "EXCEPTIONAL";

/**
 * A MANUAL value the user explicitly chose always wins - it carries intent
 * the derived signal can't see (e.g. "this subscription-looking charge was
 * actually a one-off gift"). Anything else falls back to classifyExpenseNature
 * so existing UNSET data keeps behaving exactly as before this feature shipped.
 */
export function resolveExpenseNature(transaction: Readonly<{
  recurringRuleId?: string;
  plannedTransactionId?: string;
  expenseNatureUser?: ResolvedExpenseNature;
  expenseNatureSource?: ExpenseNatureSource;
}>): ResolvedExpenseNature {
  if (transaction.expenseNatureSource === "MANUAL" && transaction.expenseNatureUser) {
    return transaction.expenseNatureUser;
  }
  return classifyExpenseNature(transaction);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/unit/expense-nature.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/export/expense-nature.ts tests/unit/expense-nature.test.ts
git commit -m "feat: resolve expense nature from manual override or derived classification"
```

---

### Task 3: 도메인 — 소비 구조 계산 (`spend-composition.ts`)

**Files:**
- Create: `src/domain/export/spend-composition.ts`
- Test: `tests/unit/spend-composition.test.ts`

**Interfaces:**
- Consumes: `ResolvedExpenseNature` (Task 2).
- Produces: `export type SpendCompositionInput = Readonly<{ baseAmount: number; nature: ResolvedExpenseNature }>`, `export type SpendComposition = Readonly<{ totalExpenseBaseAmount: number; exceptionalBaseAmount: number; oneTimeBaseAmount: number; habitualBaseAmount: number; adjustedExpenseBaseAmount: number; natureBreakdown: Readonly<Record<ResolvedExpenseNature, number>> }>`, `export function calculateSpendComposition(expenses: readonly SpendCompositionInput[]): SpendComposition`.

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// tests/unit/spend-composition.test.ts
import { describe, expect, it } from "vitest";
import { calculateSpendComposition } from "@/domain/export/spend-composition";

describe("calculateSpendComposition", () => {
  it("Case B: 예외 소비를 제외한 조정 소비를 계산한다", () => {
    const result = calculateSpendComposition([
      { baseAmount: 200_000, nature: "UNKNOWN" },
      { baseAmount: 100_000, nature: "UNKNOWN" },
      { baseAmount: 600_000, nature: "EXCEPTIONAL" },
    ]);
    expect(result.totalExpenseBaseAmount).toBe(900_000);
    expect(result.exceptionalBaseAmount).toBe(600_000);
    expect(result.adjustedExpenseBaseAmount).toBe(300_000);
  });

  it("Case C: 일회성 소비는 공식 총 소비에 포함된 채 별도로도 집계된다", () => {
    const result = calculateSpendComposition([
      { baseAmount: 300_000, nature: "RECURRING" },
      { baseAmount: 120_000, nature: "ONE_TIME" },
    ]);
    expect(result.totalExpenseBaseAmount).toBe(420_000);
    expect(result.oneTimeBaseAmount).toBe(120_000);
    expect(result.adjustedExpenseBaseAmount).toBe(420_000);
  });

  it("평소/생활 소비는 RECURRING과 IRREGULAR만 포함한다", () => {
    const result = calculateSpendComposition([
      { baseAmount: 100_000, nature: "RECURRING" },
      { baseAmount: 50_000, nature: "IRREGULAR" },
      { baseAmount: 70_000, nature: "ONE_TIME" },
      { baseAmount: 30_000, nature: "UNKNOWN" },
      { baseAmount: 600_000, nature: "EXCEPTIONAL" },
    ]);
    expect(result.habitualBaseAmount).toBe(150_000);
    expect(result.natureBreakdown).toEqual({
      RECURRING: 100_000,
      ONE_TIME: 70_000,
      IRREGULAR: 50_000,
      EXCEPTIONAL: 600_000,
      UNKNOWN: 30_000,
    });
  });

  it("빈 입력에서도 안전한 0을 반환한다", () => {
    const result = calculateSpendComposition([]);
    expect(result.totalExpenseBaseAmount).toBe(0);
    expect(result.adjustedExpenseBaseAmount).toBe(0);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/unit/spend-composition.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: 구현**

```typescript
// src/domain/export/spend-composition.ts
import type { ResolvedExpenseNature } from "./expense-nature";

export type SpendCompositionInput = Readonly<{ baseAmount: number; nature: ResolvedExpenseNature }>;

export type SpendComposition = Readonly<{
  totalExpenseBaseAmount: number;
  exceptionalBaseAmount: number;
  oneTimeBaseAmount: number;
  /** RECURRING + IRREGULAR만 포함 - "평소/생활 소비". ONE_TIME과 EXCEPTIONAL, UNKNOWN은 제외한다. */
  habitualBaseAmount: number;
  /** 총 소비 - 예외 소비. 공식 지출 통계를 대체하지 않는 참고 지표다. */
  adjustedExpenseBaseAmount: number;
  natureBreakdown: Readonly<Record<ResolvedExpenseNature, number>>;
}>;

const HABITUAL_NATURES: readonly ResolvedExpenseNature[] = ["RECURRING", "IRREGULAR"];

function assertSafeAmount(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} must be a non-negative safe integer`);
}

export function calculateSpendComposition(expenses: readonly SpendCompositionInput[]): SpendComposition {
  const natureBreakdown: Record<ResolvedExpenseNature, number> = {
    RECURRING: 0, ONE_TIME: 0, IRREGULAR: 0, EXCEPTIONAL: 0, UNKNOWN: 0,
  };
  let total = 0;
  for (const expense of expenses) {
    assertSafeAmount(expense.baseAmount, "expense baseAmount");
    natureBreakdown[expense.nature] += expense.baseAmount;
    total += expense.baseAmount;
  }
  const exceptional = natureBreakdown.EXCEPTIONAL;
  const habitual = HABITUAL_NATURES.reduce((sum, nature) => sum + natureBreakdown[nature], 0);
  return {
    totalExpenseBaseAmount: total,
    exceptionalBaseAmount: exceptional,
    oneTimeBaseAmount: natureBreakdown.ONE_TIME,
    habitualBaseAmount: habitual,
    adjustedExpenseBaseAmount: total - exceptional,
    natureBreakdown,
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/unit/spend-composition.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/export/spend-composition.ts tests/unit/spend-composition.test.ts
git commit -m "feat: add spend composition domain calculation"
```

---

### Task 4: 도메인 — 지출 집중도 (`concentration.ts`)

**Files:**
- Create: `src/domain/export/concentration.ts`
- Test: `tests/unit/concentration.test.ts`

**Interfaces:**
- Produces: `export type ConcentrationInput = Readonly<{ id: string; baseAmount: number }>`, `export type SpendConcentration = Readonly<{ top1Share: number | null; top3Share: number | null; top5Share: number | null; topTransactionIds: readonly string[] }>`, `export function calculateSpendConcentration(expenses: readonly ConcentrationInput[]): SpendConcentration`.

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// tests/unit/concentration.test.ts
import { describe, expect, it } from "vitest";
import { calculateSpendConcentration } from "@/domain/export/concentration";

describe("calculateSpendConcentration", () => {
  it("금액 내림차순 상위 1/3/5개 비중을 계산한다", () => {
    const result = calculateSpendConcentration([
      { id: "family", baseAmount: 600_000 },
      { id: "gym", baseAmount: 360_000 },
      { id: "keyboard", baseAmount: 117_000 },
      { id: "food-1", baseAmount: 50_000 },
      { id: "food-2", baseAmount: 30_000 },
      { id: "food-3", baseAmount: 20_000 },
    ]);
    const total = 600_000 + 360_000 + 117_000 + 50_000 + 30_000 + 20_000;
    expect(result.top1Share).toBeCloseTo(600_000 / total, 6);
    expect(result.top3Share).toBeCloseTo((600_000 + 360_000 + 117_000) / total, 6);
    expect(result.top5Share).toBeCloseTo((total - 20_000) / total, 6);
    expect(result.topTransactionIds).toEqual(["family", "gym", "keyboard", "food-1", "food-2"]);
  });

  it("지출 거래가 없으면 null을 반환하고 0으로 위장하지 않는다", () => {
    const result = calculateSpendConcentration([]);
    expect(result.top1Share).toBeNull();
    expect(result.top3Share).toBeNull();
    expect(result.top5Share).toBeNull();
    expect(result.topTransactionIds).toEqual([]);
  });

  it("거래가 5건 미만이면 있는 만큼만 top5에 포함한다", () => {
    const result = calculateSpendConcentration([{ id: "a", baseAmount: 10_000 }, { id: "b", baseAmount: 5_000 }]);
    expect(result.top5Share).toBe(1);
    expect(result.topTransactionIds).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/unit/concentration.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: 구현**

```typescript
// src/domain/export/concentration.ts
export type ConcentrationInput = Readonly<{ id: string; baseAmount: number }>;
export type SpendConcentration = Readonly<{
  top1Share: number | null;
  top3Share: number | null;
  top5Share: number | null;
  topTransactionIds: readonly string[];
}>;

function assertSafeAmount(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} must be a non-negative safe integer`);
}

function share(sorted: readonly ConcentrationInput[], count: number, total: number): number | null {
  if (total === 0) return null;
  const sum = sorted.slice(0, count).reduce((subtotal, item) => subtotal + item.baseAmount, 0);
  return sum / total;
}

export function calculateSpendConcentration(expenses: readonly ConcentrationInput[]): SpendConcentration {
  for (const expense of expenses) assertSafeAmount(expense.baseAmount, "expense baseAmount");
  const sorted = [...expenses].sort((left, right) => right.baseAmount - left.baseAmount);
  const total = expenses.reduce((sum, item) => sum + item.baseAmount, 0);
  return {
    top1Share: share(sorted, 1, total),
    top3Share: share(sorted, 3, total),
    top5Share: share(sorted, 5, total),
    topTransactionIds: sorted.slice(0, 5).map((item) => item.id),
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/unit/concentration.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/export/concentration.ts tests/unit/concentration.test.ts
git commit -m "feat: add spend concentration domain calculation"
```

---

### Task 5: 도메인 — 현금흐름 Horizon 분리와 Safe-to-Spend 확장

**Files:**
- Modify: `src/domain/forecasts/spendable.ts`
- Test: `tests/unit/spendable-horizon.test.ts` (신규)

**Interfaces:**
- Consumes: 없음 (순수 함수, 기존 `ForecastDeduction` 확장).
- Produces: `export type HorizonDeduction = ForecastDeduction & Readonly<{ dueDate: string }>`, `export function splitDeductionsByHorizon(deductions: readonly HorizonDeduction[], cutoffDate: string): Readonly<{ nearTerm: readonly HorizonDeduction[]; longTerm: readonly HorizonDeduction[] }>`, `export function calculateSafeToSpend(liquidAssets: number, nearTermOutflow: number, emergencyFundAmount: number): number`. 기존 `calculateFreeSpendable`/`calculateDailySpendable`/`aggregateRequiredCashflow`는 그대로 유지한다(하위 호환).

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// tests/unit/spendable-horizon.test.ts
import { describe, expect, it } from "vitest";
import { calculateSafeToSpend, splitDeductionsByHorizon, type HorizonDeduction } from "@/domain/forecasts/spendable";

describe("splitDeductionsByHorizon", () => {
  it("cutoffDate 이전/이후 확정 현금유출을 분리한다", () => {
    const deductions: HorizonDeduction[] = [
      { amount: 100_000, provenance: "card:visa", dueDate: "2026-08-25" },
      { amount: 120_000, provenance: "installment:seq-4", dueDate: "2026-11-25" },
    ];
    const result = splitDeductionsByHorizon(deductions, "2026-09-01");
    expect(result.nearTerm.map((item) => item.provenance)).toEqual(["card:visa"]);
    expect(result.longTerm.map((item) => item.provenance)).toEqual(["installment:seq-4"]);
  });

  it("cutoffDate와 같은 날짜는 근거리(nearTerm)로 취급한다", () => {
    const deductions: HorizonDeduction[] = [{ amount: 50_000, provenance: "card:visa", dueDate: "2026-09-01" }];
    const result = splitDeductionsByHorizon(deductions, "2026-09-01");
    expect(result.nearTerm).toHaveLength(1);
    expect(result.longTerm).toHaveLength(0);
  });
});

describe("calculateSafeToSpend", () => {
  it("Case E: 자산 500,000 / 확정지출 100,000 / 비상금 200,000 -> 200,000", () => {
    expect(calculateSafeToSpend(500_000, 100_000, 200_000)).toBe(200_000);
  });

  it("음수가 되어도 그대로 반환한다(사용 가능 금액이 없다는 신호)", () => {
    expect(calculateSafeToSpend(100_000, 100_000, 200_000)).toBe(-200_000);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/unit/spendable-horizon.test.ts`
Expected: FAIL — exports not found.

- [ ] **Step 3: 구현**

`src/domain/forecasts/spendable.ts` 끝에 추가:

```typescript
export type HorizonDeduction = ForecastDeduction & Readonly<{ dueDate: string }>;

export function splitDeductionsByHorizon(
  deductions: readonly HorizonDeduction[],
  cutoffDate: string,
): Readonly<{ nearTerm: readonly HorizonDeduction[]; longTerm: readonly HorizonDeduction[] }> {
  const nearTerm = deductions.filter((item) => item.dueDate <= cutoffDate);
  const longTerm = deductions.filter((item) => item.dueDate > cutoffDate);
  return { nearTerm, longTerm };
}

/**
 * Safe-to-Spend는 재정 안전성을 보장하지 않는다 - 현재 입력된 데이터를 기반으로
 * "이 금액 밑으로는 떨어뜨리고 싶지 않다"는 사용자 지정 비상금 기준을 뺀
 * 참고 지표일 뿐이다.
 */
export function calculateSafeToSpend(liquidAssets: number, nearTermOutflow: number, emergencyFundAmount: number): number {
  return liquidAssets - nearTermOutflow - emergencyFundAmount;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/unit/spendable-horizon.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/forecasts/spendable.ts tests/unit/spendable-horizon.test.ts
git commit -m "feat: split forecast deductions by cashflow horizon and add safe-to-spend"
```

---

### Task 6: 서버 — 거래 생성/수정에 소비 성격 필드 반영

**Files:**
- Modify: `src/server/transactions/service.ts`
- Modify: `src/server/transactions/repository.ts`
- Test: `tests/unit/transaction-service.test.ts` (기존 파일에 케이스 추가)

**Interfaces:**
- Consumes: `ResolvedExpenseNature`(Task 2 — MANUAL 저장 시 `RECURRING`/`ONE_TIME`/`IRREGULAR`/`EXCEPTIONAL`/`UNKNOWN` 중 하나).
- Produces: `TransactionInput.expenseNatureUser?: "RECURRING" | "ONE_TIME" | "IRREGULAR" | "EXCEPTIONAL" | "UNKNOWN"`, `TransactionRecord.expenseNatureUser?`, `TransactionRecord.expenseNatureSource: "UNSET" | "MANUAL" | "SUGGESTED"`.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/transaction-service.test.ts` 상단 import 아래에 추가:

```typescript
it("소비 성격을 지정하면 MANUAL 출처로 저장하고, 비워두면 UNSET을 유지한다", async () => {
  const created: unknown[] = [];
  const repository = {
    findAccount: async () => ({ id: "acc-1", userId: "user-1", type: "BANK" as const, isActive: true }),
    findCategory: async () => null,
    create: async (userId: string, input: unknown) => { created.push(input); return { id: "tx-1", userId, ...(input as object) } as never; },
  } as never;
  const service = createTransactionService(repository);
  await service.create("user-1", {
    type: "EXPENSE", amount: 60_000, baseAmount: 60_000, currency: "KRW",
    transactionAt: "2026-08-18T00:00:00.000Z", accountId: "acc-1",
    expenseNatureUser: "EXCEPTIONAL",
  } as never);
  expect(created[0]).toMatchObject({ expenseNatureUser: "EXCEPTIONAL", expenseNatureSource: "MANUAL" });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/unit/transaction-service.test.ts`
Expected: FAIL — `expenseNatureSource` undefined in created input.

- [ ] **Step 3: 구현 — service.ts**

`TransactionInput`, `TransactionRecord` 타입과 `validate()`를 수정한다:

```typescript
import type { ResolvedExpenseNature } from "@/domain/export/expense-nature";

type TransactionInput = Readonly<{
  type: TransactionType; amount: number; baseAmount: number; currency: string; transactionAt: string;
  accountId?: string; fromAccountId?: string; toAccountId?: string; categoryId?: string; exchangeRate?: string; memo?: string;
  expenseNatureUser?: ResolvedExpenseNature;
}>;
export type TransactionRecord = Readonly<TransactionInput & {
  id: string; userId: string; status: TransactionStatus;
  expenseNatureSource: "UNSET" | "MANUAL" | "SUGGESTED";
}>;
```

(파일 상단 import 목록에 `import type { ResolvedExpenseNature } from "@/domain/export/expense-nature";`를 추가한다.)

`validate()` 마지막에 있는 두 개의 `return { ...input, ... }` 각각에 `expenseNatureSource: input.expenseNatureUser ? "MANUAL" as const : "UNSET" as const` 를 추가한다(TRANSFER 분기, 나머지 분기 둘 다). TRANSFER 타입은 소비가 아니므로 `expenseNatureUser`가 와도 무시하도록 TRANSFER 분기에서는 `expenseNatureUser: undefined, expenseNatureSource: "UNSET" as const`로 고정한다.

- [ ] **Step 4: 구현 — repository.ts**

`src/server/transactions/repository.ts`에서 `create`/`update`가 매핑하는 컬럼 목록에 `expense_nature_user: input.expenseNatureUser ?? null, expense_nature_source: input.expenseNatureSource`를 추가하고, DB row → `TransactionRecord` 매핑에도 `expenseNatureUser: row.expense_nature_user ?? undefined, expenseNatureSource: row.expense_nature_source`를 추가한다. (정확한 삽입/조회 컬럼 리스트 위치는 파일 내 `insert(` / `.select(`와 매핑 함수를 찾아 기존 필드들과 동일한 패턴으로 추가한다.)

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run tests/unit/transaction-service.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/transactions/service.ts src/server/transactions/repository.ts tests/unit/transaction-service.test.ts
git commit -m "feat: persist user-specified expense nature on transactions"
```

---

### Task 7: UI — 거래 수정 화면에 소비 성격 선택 추가 (QuickEntryForm은 변경하지 않음)

**Files:**
- Modify: `src/components/transactions/EditTransactionForm.tsx`
- Modify: `src/app/(app)/(shell)/transactions/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: Task 6의 `TransactionRecord.expenseNatureUser`/`expenseNatureSource`.
- Produces: 폼 `name="expenseNatureUser"` (빈 값 = 미지정 = UNSET 유지).

- [ ] **Step 1: `EditTransaction` 타입과 select 추가**

`EditTransactionForm.tsx`의 `EditTransaction` 타입에 `expenseNatureUser?: "RECURRING" | "ONE_TIME" | "IRREGULAR" | "EXCEPTIONAL" | "UNKNOWN"`를 추가하고, 컴포넌트 상단에 라벨 상수를 추가한다:

```typescript
const EXPENSE_NATURE_LABELS: Record<"RECURRING" | "ONE_TIME" | "IRREGULAR" | "EXCEPTIONAL" | "UNKNOWN", string> = {
  RECURRING: "정기",
  ONE_TIME: "일회성",
  IRREGULAR: "비정기",
  EXCEPTIONAL: "예외적",
  UNKNOWN: "미분류",
};
```

`transaction.type !== "TRANSFER"`인 경우에만 카드 하단(통화 Select 다음)에 추가:

```tsx
{transaction.type === "EXPENSE" ? (
  <div className="flex-1">
    <Select
      label="소비 성격"
      name="expenseNatureUser"
      value={expenseNatureUser}
      onChange={(event) => setExpenseNatureUser(event.target.value)}
    >
      <option value="">지정 안 함</option>
      {(Object.keys(EXPENSE_NATURE_LABELS) as (keyof typeof EXPENSE_NATURE_LABELS)[]).map((value) => (
        <option key={value} value={value}>{EXPENSE_NATURE_LABELS[value]}</option>
      ))}
    </Select>
  </div>
) : null}
```

`useState` 목록에 `const [expenseNatureUser, setExpenseNatureUser] = useState(transaction.expenseNatureUser ?? "");` 추가.

- [ ] **Step 2: edit page.tsx 서버 액션에서 값 전달**

`submitEdit`에서 EXPENSE 분기에 `expenseNatureUser` 파싱을 추가:

```typescript
const expenseNatureUserRaw = String(formData.get("expenseNatureUser") ?? "");
const expenseNatureUser = expenseNatureUserRaw ? (expenseNatureUserRaw as "RECURRING" | "ONE_TIME" | "IRREGULAR" | "EXCEPTIONAL" | "UNKNOWN") : undefined;
```

`updateTransactionForCurrentUser(id, { ..., expenseNatureUser })`의 EXPENSE 분기 호출에 `expenseNatureUser`를 추가한다. 페이지 컴포넌트에서 `EditTransactionForm`에 넘기는 `transaction` 객체에도 `expenseNatureUser: transaction.expenseNatureUser`를 추가한다.

- [ ] **Step 3: 수동 확인**

Run: `npm run dev`
브라우저에서 지출 거래를 수정 화면에 진입 → "소비 성격" select가 보이는지, "지정 안 함" 상태로 저장하면 값이 바뀌지 않는지, "예외적"으로 저장 후 다시 열면 유지되는지 확인.

- [ ] **Step 4: Commit**

```bash
git add src/components/transactions/EditTransactionForm.tsx "src/app/(app)/(shell)/transactions/[id]/edit/page.tsx"
git commit -m "feat: let users set expense nature when editing a transaction"
```

---

### Task 8: UI — 카테고리/태그 의미를 텍스트로 명확화

**Files:**
- Modify: `src/components/transactions/QuickEntryForm.tsx`
- Modify: `src/components/transactions/EditTransactionForm.tsx`

**Interfaces:** 없음 (텍스트만 추가, 스키마/로직 변경 없음).

- [ ] **Step 1: QuickEntryForm 카테고리/태그 라벨 보강**

`categoryPicker`의 `<Select label="카테고리" ...>`를 `<Select label="카테고리 (무엇을 샀나요)" ...>`로, 태그 `fieldset`의 `<legend>`를 `<legend className="text-sm font-medium text-content-secondary">태그 (왜, 어떤 상황이었나요)</legend>`로 변경한다.

- [ ] **Step 2: EditTransactionForm도 동일하게 변경**

`<Select label="카테고리" ...>` → `<Select label="카테고리 (무엇을 샀나요)" ...>`. (EditTransactionForm에는 태그 편집 UI가 없으므로 카테고리 라벨만 수정한다.)

- [ ] **Step 3: 수동 확인**

Run: `npm run dev`
빠른 입력/수정 화면에서 라벨 문구가 바뀌었는지 육안 확인.

- [ ] **Step 4: Commit**

```bash
git add src/components/transactions/QuickEntryForm.tsx src/components/transactions/EditTransactionForm.tsx
git commit -m "docs: clarify category vs tag meaning in transaction form labels"
```

---

### Task 9: 서버 — 비상금 설정 (profiles.emergency_fund_amount)

**Files:**
- Create: `src/server/profile/service.ts`
- Create: `src/server/profile/repository.ts`
- Create: `src/server/profile/index.ts`
- Create: `src/components/settings/EmergencyFundSettings.tsx`
- Modify: `src/app/(app)/(shell)/settings/page.tsx`
- Modify: `src/server/auth/require-profile.ts` (select에 `emergency_fund_amount` 추가)
- Test: `tests/unit/profile-service.test.ts` (신규)

**Interfaces:**
- Produces: `export function createProfileService(repository): { updateEmergencyFund(userId: string, amount: number | null): Promise<void> }`.

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// tests/unit/profile-service.test.ts
import { describe, expect, it } from "vitest";
import { createProfileService } from "@/server/profile/service";

describe("profile service", () => {
  it("음수 비상금 기준액을 거부한다", async () => {
    const service = createProfileService({ updateEmergencyFund: async () => {} });
    await expect(service.updateEmergencyFund("user-1", -1)).rejects.toThrow();
  });

  it("null을 전달하면 비상금 설정을 해제한다", async () => {
    let received: number | null = 0;
    const service = createProfileService({ updateEmergencyFund: async (_userId, amount) => { received = amount; } });
    await service.updateEmergencyFund("user-1", null);
    expect(received).toBeNull();
  });

  it("정수가 아닌 금액을 거부한다", async () => {
    const service = createProfileService({ updateEmergencyFund: async () => {} });
    await expect(service.updateEmergencyFund("user-1", 1.5)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/unit/profile-service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: service.ts / repository.ts / index.ts 구현**

```typescript
// src/server/profile/service.ts
import "server-only";

export interface ProfileRepository {
  updateEmergencyFund(userId: string, amount: number | null): Promise<void>;
}

export function createProfileService(repository: ProfileRepository) {
  return {
    async updateEmergencyFund(userId: string, amount: number | null): Promise<void> {
      if (amount !== null && (!Number.isSafeInteger(amount) || amount < 0)) {
        throw new Error("emergency fund amount must be a non-negative integer");
      }
      await repository.updateEmergencyFund(userId, amount);
    },
  };
}
```

```typescript
// src/server/profile/repository.ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileRepository } from "./service";

export function createProfileRepository(supabase: SupabaseClient): ProfileRepository {
  return {
    async updateEmergencyFund(userId, amount) {
      const { error } = await supabase.from("profiles").update({ emergency_fund_amount: amount }).eq("id", userId);
      if (error) throw new Error(error.message);
    },
  };
}
```

```typescript
// src/server/profile/index.ts
import "server-only";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { createProfileRepository } from "./repository";
import { createProfileService } from "./service";

export async function updateEmergencyFundForCurrentUser(userId: string, amount: number | null): Promise<void> {
  const supabase = await createSupabaseServerClient();
  return createProfileService(createProfileRepository(supabase)).updateEmergencyFund(userId, amount);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/unit/profile-service.test.ts`
Expected: PASS.

- [ ] **Step 5: `require-profile.ts`에 컬럼 추가**

`select("id, role, onboarding_completed, salary_cycle_day")`를 `select("id, role, onboarding_completed, salary_cycle_day, emergency_fund_amount")`로 수정.

- [ ] **Step 6: Settings 페이지 UI**

```tsx
// src/components/settings/EmergencyFundSettings.tsx
"use client";
import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";

export type EmergencyFundState = Readonly<{ status: "idle" | "success" | "error"; message?: string }>;
export type EmergencyFundAction = (state: EmergencyFundState, formData: FormData) => Promise<EmergencyFundState>;

export function EmergencyFundSettings({ currentAmount, action }: Readonly<{ currentAmount: number | null; action: EmergencyFundAction }>) {
  const [state, formAction, isPending] = useActionState(action, { status: "idle" });
  const [amount, setAmount] = useState(currentAmount !== null ? String(currentAmount) : "");

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-content-primary">비상금 기준</h2>
      <p className="text-sm text-content-secondary">
        이 금액 이하로는 잔액을 떨어뜨리고 싶지 않다는 기준이에요. 사용 가능 금액(Safe-to-Spend) 계산에 사용됩니다.
      </p>
      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField label="비상금 (KRW)" name="amount" inputMode="numeric" pattern="\d*" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="예: 200000" />
        </div>
        <Button type="submit" disabled={isPending}>저장</Button>
      </form>
      {state.status === "error" ? <Alert kind="error" role="alert">{state.message}</Alert> : null}
      {state.status === "success" ? <Alert kind="success" role="status">저장했습니다.</Alert> : null}
    </Card>
  );
}
```

`settings/page.tsx`에 서버 액션과 컴포넌트를 연결한다:

```tsx
import { EmergencyFundSettings, type EmergencyFundState } from "@/components/settings/EmergencyFundSettings";
import { updateEmergencyFundForCurrentUser } from "@/server/profile";

async function submitEmergencyFund(userId: string, _previous: EmergencyFundState, formData: FormData): Promise<EmergencyFundState> {
  "use server";
  try {
    const raw = String(formData.get("amount") ?? "").trim();
    await updateEmergencyFundForCurrentUser(userId, raw === "" ? null : Number(raw));
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "저장에 실패했습니다." };
  }
  return { status: "success" };
}
```

`SettingsPage` 컴포넌트의 반환 JSX, `<BackupRestore />` 앞에 `<EmergencyFundSettings currentAmount={profile.emergency_fund_amount ?? null} action={submitEmergencyFund.bind(null, profile.id)} />`를 추가한다. (`requireCurrentProfile()`의 select에 `emergency_fund_amount`가 이미 포함되도록 Step 5에서 수정했으므로 `profile.emergency_fund_amount`를 그대로 사용할 수 있다.)

- [ ] **Step 7: 수동 확인**

Run: `npm run dev`
설정 화면에서 비상금 입력 후 저장 → 새로고침해도 값이 유지되는지 확인. 빈 값으로 저장하면 `null`로 해제되는지 확인.

- [ ] **Step 8: Commit**

```bash
git add src/server/profile src/components/settings/EmergencyFundSettings.tsx "src/app/(app)/(shell)/settings/page.tsx" src/server/auth/require-profile.ts tests/unit/profile-service.test.ts
git commit -m "feat: let users set an emergency fund threshold for safe-to-spend"
```

---

### Task 10: 서버 — Export repository에 소비 성격/집중도/Safe-to-Spend 데이터 배선

**Files:**
- Modify: `src/server/export/repository.ts`
- Modify: `src/domain/export/markdown.ts` (`ExportTransaction`/`ExportReadModel` 타입 확장)
- Test: `tests/integration/export.test.ts` (기존 파일에 케이스 추가)

**Interfaces:**
- Consumes: Task 2 `resolveExpenseNature`, Task 5 `HorizonDeduction`/`splitDeductionsByHorizon`/`calculateSafeToSpend`.
- Produces: `ExportTransaction`에 `expenseNatureUser?`, `expenseNatureSource?` 추가. `ExportReadModel`에 `emergencyFundAmount?: number`, `nextPaydayDate?: string`, `horizonDeductions?: readonly HorizonDeduction[]` 추가.

- [ ] **Step 1: `markdown.ts` 타입 확장**

`ExportTransaction`에 `expenseNatureUser?: ResolvedExpenseNature; expenseNatureSource?: ExpenseNatureSource;` 추가(파일 상단에 `import type { ResolvedExpenseNature, ExpenseNatureSource } from "./expense-nature";` 추가). `ExportReadModel`에 다음 필드 추가:

```typescript
  /** 설정한 경우에만 존재 - Safe-to-Spend 계산에 사용한다. */
  emergencyFundAmount?: number;
  /** profiles.salary_cycle_day를 설정한 경우에만 존재. */
  nextPaydayDate?: string;
  /** 다음 급여일 이전/이후로 나뉘는 확정 현금유출. profiles.salary_cycle_day가 없으면 비어 있다. */
  horizonDeductions?: readonly HorizonDeduction[];
```

- [ ] **Step 2: repository.ts 데이터 배선**

`createExportRepository`에서 `profiles` select에 `salary_cycle_day, emergency_fund_amount`를 추가하고, 반환 객체에 다음을 추가한다:

```typescript
supabase.from("profiles").select("base_currency,salary_cycle_day,emergency_fund_amount").eq("id", userId).maybeSingle(),
```

`getSalaryCycle`(이미 `@/lib/dates/salary-cycle`에 존재)로 `nextPaydayDate = addIsoDays(getSalaryCycle(todayInSeoul(), profile.salary_cycle_day).end, 1)`를 계산한다(값이 없으면 필드 자체를 생략).

`horizonDeductions`는 기존 `installmentFutureResult`(SCHEDULED 할부 payment) 각 건을 `{ amount: principal+fee, provenance: "installment:{id}", dueDate: scheduled_date }`로 매핑하고, 카드별 미결제 잔액 중 할부에 속하지 않는 부분은 `credit_card_settings`의 `payment_day`로 다음 결제일을 계산해 하나의 `{ provenance: "card:{accountId}", dueDate }` 항목으로 추가한다. (카드별 미결제 잔액과 할부 SCHEDULED 합계는 이미 `assetService.getOverview`가 `cards[].outstanding`/`cards[].installmentSchedule`로 제공하므로, 이 저장소에서 새 쿼리를 만들지 말고 `assetService.getOverview(userId)` 결과의 `cards`를 그대로 사용한다.)

```typescript
import { getSalaryCycle } from "@/lib/dates/salary-cycle";
import type { HorizonDeduction } from "@/domain/forecasts/spendable";

function nextCardPaymentDate(paymentDay: number, today: string): string {
  const [year, month, day] = today.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const candidateDay = Math.min(paymentDay, lastDay);
  if (day <= candidateDay) return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(candidateDay).padStart(2, "0")}`;
  const nextMonthLastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const nextCandidateDay = Math.min(paymentDay, nextMonthLastDay);
  const nextMonthDate = new Date(Date.UTC(year, month, nextCandidateDay));
  return nextMonthDate.toISOString().slice(0, 10);
}

function buildHorizonDeductions(assets: Awaited<ReturnType<typeof assetService.getOverview>>, today: string): HorizonDeduction[] {
  return assets.cards.flatMap((card): HorizonDeduction[] => {
    const scheduledInstallmentTotal = card.installmentSchedule
      .filter((payment) => payment.status === "SCHEDULED")
      .reduce((sum, payment) => sum + payment.paymentAmount, 0);
    const nonInstallmentBalance = Math.max(0, card.outstanding - scheduledInstallmentTotal);
    const installmentDeductions = card.installmentSchedule
      .filter((payment) => payment.status === "SCHEDULED")
      .map((payment): HorizonDeduction => ({ amount: payment.paymentAmount, provenance: `installment:${payment.id}`, dueDate: payment.scheduledDate }));
    if (nonInstallmentBalance === 0 || card.paymentDay === null) return installmentDeductions;
    return [
      ...installmentDeductions,
      { amount: nonInstallmentBalance, provenance: `card:${card.id}`, dueDate: nextCardPaymentDate(card.paymentDay, today) },
    ];
  });
}
```

이 함수를 `getReadData` 안에서 호출해 `horizonDeductions: buildHorizonDeductions(assets, todayInSeoul())`로 반환값에 추가한다. `profile.emergency_fund_amount`가 `null`이 아니면 `emergencyFundAmount: asSafeInteger(profile.emergency_fund_amount, "emergency_fund_amount")`를, `profile.salary_cycle_day`가 있으면 `nextPaydayDate`를 반환 객체에 추가한다(둘 다 optional 필드이므로 spread 패턴 `...(condition ? { field: value } : {})` 사용).

`mapTransaction`에도 `expenseNatureUser`/`expenseNatureSource` 매핑을 추가하고, 트랜잭션 select 쿼리 컬럼에 `expense_nature_user,expense_nature_source`를 추가한다.

- [ ] **Step 3: 통합 테스트 확인**

Run: `npm run test:integration -- export`
Expected: PASS (기존 export 통합 테스트가 신규 optional 필드 추가에 영향받지 않는지 확인. 실패 시 시드 데이터에 `salary_cycle_day`/`emergency_fund_amount` 컬럼이 select에 포함되어 있는지 점검).

- [ ] **Step 4: Commit**

```bash
git add src/server/export/repository.ts src/domain/export/markdown.ts tests/integration/export.test.ts
git commit -m "feat: wire expense nature and cashflow horizon data into export read model"
```

---

### Task 11: AI Export — 소비 구조/집중도/현금흐름/Safe-to-Spend 섹션 추가

**Files:**
- Modify: `src/domain/export/presets.ts`
- Modify: `src/domain/export/markdown.ts`
- Modify: `src/domain/export/analysis-json.ts`
- Modify: `tests/unit/export-json.test.ts`, `tests/unit/export-markdown.test.ts` (기존 파일 갱신)

**Interfaces:**
- Consumes: Task 3 `calculateSpendComposition`, Task 4 `calculateSpendConcentration`, Task 5 `splitDeductionsByHorizon`/`calculateSafeToSpend`, Task 10의 `ExportReadModel` 확장 필드.
- Produces: `AnalysisJson.metadata.schema_version = 2`, `AnalysisJson.expense_nature`(5분류로 확장), 신규 `AnalysisJson.spend_composition`, `AnalysisJson.concentration`, `AnalysisJson.cashflow_horizon`, optional `AnalysisJson.spendable`.

- [ ] **Step 1: presets.ts에 신규 섹션 추가**

```typescript
export type ExportSection = "BUDGETS" | "CATEGORY_SPENDING" | "TAG_SPENDING" | "PAYMENT_METHODS" | "EXTERNAL_FLOWS" | "EXPENSE_NATURE" | "SPEND_COMPOSITION" | "CONCENTRATION" | "CASHFLOW_HORIZON" | "SPENDABLE" | "CARDS" | "SAVINGS_GOALS" | "PLANNED_CASHFLOWS" | "FUTURE_CASHFLOWS" | "TRANSACTIONS";
```

`SPENDING_REVIEW.sections`에 `"EXPENSE_NATURE"` 뒤에 `"SPEND_COMPOSITION", "CONCENTRATION"`을 추가하고, `"FUTURE_CASHFLOWS"` 뒤에 `"CASHFLOW_HORIZON", "SPENDABLE"`을 추가한다. `FINANCIAL_HEALTH.sections`에도 동일하게 `"CASHFLOW_HORIZON", "SPENDABLE"`을 `"FUTURE_CASHFLOWS"` 뒤에 추가한다.

- [ ] **Step 2: markdown.ts — `expenseNatureBreakdown` 5분류로 교체**

기존 `expenseNatureBreakdown`을 제거하고 `resolveExpenseNature` 기반으로 교체:

```typescript
import { resolveExpenseNature, type ResolvedExpenseNature } from "@/domain/export/expense-nature";
import { calculateSpendComposition } from "@/domain/export/spend-composition";
import { calculateSpendConcentration } from "@/domain/export/concentration";
import { splitDeductionsByHorizon, calculateSafeToSpend, type HorizonDeduction } from "@/domain/forecasts/spendable";

export function expenseNatureBreakdown(transactions: readonly ActualTransaction[]): Readonly<Record<ResolvedExpenseNature, number>> {
  const composition = calculateSpendComposition(
    transactions.filter((transaction) => transaction.type === "EXPENSE").map((transaction) => ({ baseAmount: transaction.baseAmount, nature: resolveExpenseNature(transaction) })),
  );
  return composition.natureBreakdown;
}
```

`expenseNatureLines`를 5줄로 확장:

```typescript
function expenseNatureLines(readModel: ExportReadModel, transactions: readonly ActualTransaction[]): string[] {
  const nature = expenseNatureBreakdown(transactions);
  return [
    "## 소비 성격",
    `- 반복성 소비: ${formatMoney(BigInt(nature.RECURRING), readModel.baseCurrency)}`,
    `- 일회성 소비: ${formatMoney(BigInt(nature.ONE_TIME), readModel.baseCurrency)}`,
    `- 비정기 소비: ${formatMoney(BigInt(nature.IRREGULAR), readModel.baseCurrency)}`,
    `- 예외 소비: ${formatMoney(BigInt(nature.EXCEPTIONAL), readModel.baseCurrency)}`,
    `- 미분류 소비: ${formatMoney(BigInt(nature.UNKNOWN), readModel.baseCurrency)}`,
    "",
  ];
}
```

- [ ] **Step 3: markdown.ts — 소비 구조/집중도/현금흐름/소비 여력 섹션 함수 추가**

```typescript
function spendCompositionLines(readModel: ExportReadModel, transactions: readonly ActualTransaction[]): string[] {
  const expenseTx = transactions.filter((transaction) => transaction.type === "EXPENSE");
  const composition = calculateSpendComposition(expenseTx.map((transaction) => ({ baseAmount: transaction.baseAmount, nature: resolveExpenseNature(transaction) })));
  return [
    "## 소비 구조",
    `- 총 소비: ${formatMoney(BigInt(composition.totalExpenseBaseAmount), readModel.baseCurrency)}`,
    `- 예외 소비 제외 소비(조정 소비, 참고 지표): ${formatMoney(BigInt(composition.adjustedExpenseBaseAmount), readModel.baseCurrency)}`,
    `- 평소/생활 소비(반복+비정기): ${formatMoney(BigInt(composition.habitualBaseAmount), readModel.baseCurrency)}`,
    "",
  ];
}

function concentrationLines(readModel: ExportReadModel, transactions: readonly ActualTransaction[]): string[] {
  const expenseTx = transactions.filter((transaction) => transaction.type === "EXPENSE");
  const concentration = calculateSpendConcentration(expenseTx.map((transaction) => ({ id: transaction.id, baseAmount: transaction.baseAmount })));
  const byId = new Map(expenseTx.map((transaction) => [transaction.id, transaction]));
  const topLines = concentration.topTransactionIds.map((id) => {
    const transaction = byId.get(id);
    if (!transaction) return null;
    const label = [transaction.categoryName, transaction.memo].filter(Boolean).join(" · ");
    return `- ${dateKey(transaction.transactionDate)}: ${formatMoney(BigInt(transaction.baseAmount), readModel.baseCurrency)}${label ? ` (${label})` : ""}`;
  }).filter((line): line is string => line !== null);
  return [
    "## 지출 집중도",
    concentration.top1Share === null ? "- 계산 불가(지출 거래 없음)" : `- 상위 1개 거래 비중: ${Math.round(concentration.top1Share * 100)}%`,
    concentration.top3Share === null ? "" : `- 상위 3개 거래 비중: ${Math.round(concentration.top3Share * 100)}%`,
    concentration.top5Share === null ? "" : `- 상위 5개 거래 비중: ${Math.round(concentration.top5Share * 100)}%`,
    "### 주요 대형 거래",
    ...(topLines.length === 0 ? ["- 해당 없음"] : topLines),
    "",
  ].filter((line) => line !== "");
}

function cashflowHorizonLines(readModel: ExportReadModel): string[] {
  const deductions = readModel.horizonDeductions ?? [];
  if (!readModel.nextPaydayDate) {
    return ["## 가까운 미래 현금흐름 (근거리/장기 구분)", "- 급여일이 설정되지 않아 근거리/장기 구분을 계산할 수 없습니다. 설정에서 급여일을 등록하면 이 구분을 볼 수 있습니다.", ""];
  }
  const { nearTerm, longTerm } = splitDeductionsByHorizon(deductions, readModel.nextPaydayDate);
  const sum = (items: readonly HorizonDeduction[]) => items.reduce((total, item) => total + item.amount, 0);
  return [
    "## 가까운 미래 현금흐름 (근거리/장기 구분)",
    `- 다음 급여일: ${readModel.nextPaydayDate}`,
    `- 다음 급여일까지 확정 지출: ${formatMoney(BigInt(sum(nearTerm)), readModel.baseCurrency)}`,
    `- 장기 확정 의무(주로 할부 잔여금): ${formatMoney(BigInt(sum(longTerm)), readModel.baseCurrency)}`,
    "",
  ];
}

function spendableLines(readModel: ExportReadModel): string[] {
  if (readModel.emergencyFundAmount === undefined || !readModel.nextPaydayDate) {
    return ["## 소비 여력 (Safe-to-Spend)", "- 급여일 또는 비상금 기준이 설정되지 않아 계산할 수 없습니다. 설정에서 등록하면 이 지표를 볼 수 있습니다.", ""];
  }
  const { nearTerm } = splitDeductionsByHorizon(readModel.horizonDeductions ?? [], readModel.nextPaydayDate);
  const nearTermTotal = nearTerm.reduce((total, item) => total + item.amount, 0);
  const safeToSpend = calculateSafeToSpend(readModel.financialPosition.totalAssets, nearTermTotal, readModel.emergencyFundAmount);
  const remainingDays = Math.max(1, Math.round((new Date(readModel.nextPaydayDate).getTime() - new Date(readModel.generatedAt).getTime()) / 86_400_000));
  return [
    "## 소비 여력 (Safe-to-Spend)",
    `- 현재 자산: ${formatMoney(BigInt(readModel.financialPosition.totalAssets), readModel.baseCurrency)}`,
    `- 비상금 기준: ${formatMoney(BigInt(readModel.emergencyFundAmount), readModel.baseCurrency)}`,
    `- 다음 급여일까지 사용 가능 금액: ${formatMoney(BigInt(Math.max(0, safeToSpend)), readModel.baseCurrency)}`,
    `- 일평균 사용 가능 금액(참고): ${formatMoney(BigInt(Math.max(0, Math.floor(Math.max(0, safeToSpend) / remainingDays))), readModel.baseCurrency)}`,
    "",
  ];
}
```

`generateExportMarkdown`의 섹션 스위치에 추가:

```typescript
if (sections.includes("SPEND_COMPOSITION")) lines.push(...spendCompositionLines(readModel, transactions));
if (sections.includes("CONCENTRATION")) lines.push(...concentrationLines(readModel, transactions));
if (sections.includes("CASHFLOW_HORIZON")) lines.push(...cashflowHorizonLines(readModel));
if (sections.includes("SPENDABLE")) lines.push(...spendableLines(readModel));
```

해석 주의사항 배열 끝에 6개 문구를 추가:

```typescript
"- 총 월 지출이 곧 평소 월 생활비를 의미하지 않습니다.",
"- 예외적·일회성 대형 거래가 월 소비를 크게 왜곡할 수 있습니다.",
"- 조정 소비는 분석용 참고 지표이며 공식 지출 통계를 대체하지 않습니다.",
"- 할부 잔여금은 이미 소비로 인식된 구매의 미래 현금흐름입니다.",
"- 장기 할부 전체를 현재 소비 가능 금액에서 즉시 차감하면 실제 단기 현금흐름을 왜곡할 수 있어, 근거리/장기로 구분해서 봅니다.",
"- Safe-to-Spend(소비 여력) 값은 재정적 안전성을 보장하지 않으며, 현재 입력된 데이터를 기반으로 한 참고 지표입니다.",
```

- [ ] **Step 4: analysis-json.ts에 동일 구조 반영**

`metadata.schema_version`을 `2`로 변경. `expense_nature` 필드 타입을 5분류로 교체:

```typescript
expense_nature: Readonly<{ recurring_base_amount: number; one_time_base_amount: number; irregular_base_amount: number; exceptional_base_amount: number; unknown_base_amount: number }>;
spend_composition: Readonly<{ total_expense_base_amount: number; adjusted_expense_base_amount: number; habitual_base_amount: number }>;
concentration: Readonly<{ top1_share: number | null; top3_share: number | null; top5_share: number | null; top_transactions: readonly Readonly<{ transaction_date: string; base_amount: number; category: string | null; memo: string | null }>[] }>;
cashflow_horizon: Readonly<{ next_payday_date: string | null; near_term_confirmed_outflow_base_amount: number | null; long_term_committed_base_amount: number | null }>;
spendable?: Readonly<{ current_liquid_assets_base_amount: number; emergency_fund_base_amount: number; near_term_confirmed_outflow_base_amount: number; safe_to_spend_base_amount: number; remaining_days_until_payday: number; daily_safe_to_spend_base_amount: number }>;
```

`generateAnalysisJson` 본문에서 `expense_nature`를 5분류 매핑으로 교체하고, `spend_composition`/`concentration`/`cashflow_horizon`/(옵션)`spendable`을 markdown.ts에서 만든 것과 동일한 도메인 함수 호출로 채운다(로직 중복 금지 — 위 Step 3의 계산과 같은 `calculateSpendComposition`/`calculateSpendConcentration`/`splitDeductionsByHorizon`/`calculateSafeToSpend` 호출을 그대로 재사용). `spendable`은 `readModel.emergencyFundAmount`와 `readModel.nextPaydayDate`가 모두 있을 때만 키 자체를 포함시킨다(스프레드 조건부 패턴).

- [ ] **Step 5: 기존 테스트 갱신**

`tests/unit/export-json.test.ts`의 `Object.keys(result)` 기대값 배열에 `"spend_composition"`, `"concentration"`, `"cashflow_horizon"`을 (`"expense_nature"` 다음, `"budgets"` 이전에) 추가하고, `expense_nature` 관련 단언을 5개 필드 형태로 갱신한다. `tests/unit/export-markdown.test.ts`에서 "소비 성격" 섹션을 검증하는 부분을 5줄로 갱신하고, 새 섹션들의 스냅샷/부분 문자열 검증을 추가한다.

Run: `npx vitest run tests/unit/export-json.test.ts tests/unit/export-markdown.test.ts`
Expected: 처음 FAIL(구 구조 기대) → 테스트 갱신 후 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/export/presets.ts src/domain/export/markdown.ts src/domain/export/analysis-json.ts tests/unit/export-json.test.ts tests/unit/export-markdown.test.ts
git commit -m "feat: add spend composition, concentration, cashflow horizon and safe-to-spend to AI export"
```

---

### Task 12: 화면 — 월간 분석(통계) 화면에 소비 구조/집중도/Safe-to-Spend 표시

**Files:**
- Modify: `src/server/statistics/service.ts`
- Modify: `src/server/statistics/repository.ts`
- Modify: `src/server/statistics/index.ts`
- Modify: `src/components/statistics/StatisticsOverview.tsx`
- Test: `tests/unit/statistics-service.test.ts` (기존 파일에 케이스 추가)

**Interfaces:**
- Consumes: Task 3/4/5의 도메인 함수, Task 10에서 확장된 export 저장소 패턴과 동일한 `assetService.getOverview`/`getSalaryCycle` 조합.
- Produces: `StatisticsOverview`에 `spendComposition: SpendComposition`, `concentration: SpendConcentration & { topTransactions: readonly Readonly<{ label: string; baseAmount: number }>[] }`, `safeToSpend?: Readonly<{ amount: number; dailyAmount: number; weeklyAmount: number; nextPaydayDate: string }>` 추가(현재 Seoul 월 기준).

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/statistics-service.test.ts`에 케이스 추가:

```typescript
it("이번 달 소비 구조와 집중도를 계산한다", () => {
  const result = buildStatistics([
    { type: "EXPENSE", status: "CONFIRMED", transactionAt: `${currentMonth}-05T00:00:00.000Z`, baseAmount: 600_000, categoryName: "가족지원", tagNames: [], expenseNatureUser: "EXCEPTIONAL", expenseNatureSource: "MANUAL" },
    { type: "EXPENSE", status: "CONFIRMED", transactionAt: `${currentMonth}-06T00:00:00.000Z`, baseAmount: 200_000, categoryName: "식비", tagNames: [] },
  ], 0);
  expect(result.spendComposition.totalExpenseBaseAmount).toBe(800_000);
  expect(result.spendComposition.exceptionalBaseAmount).toBe(600_000);
  expect(result.concentration.top1Share).toBeCloseTo(0.75, 6);
});
```

(`currentMonth`는 `todayInSeoul().slice(0, 7)`로 파일 상단에 미리 계산해 둔다. 기존 테스트 파일의 날짜 픽스처 관례를 따른다.)

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/unit/statistics-service.test.ts`
Expected: FAIL — `spendComposition`/`concentration` undefined.

- [ ] **Step 3: service.ts 구현**

`StatisticsTransaction`에 `expenseNatureUser?: ResolvedExpenseNature; expenseNatureSource?: ExpenseNatureSource; plannedTransactionId?: string;`를 추가한다. `buildStatistics` 안에서 이번 달(가장 최근 `months` 항목) 지출만 모아 `calculateSpendComposition`/`calculateSpendConcentration`을 호출하고 반환 객체에 추가한다:

```typescript
import { resolveExpenseNature } from "@/domain/export/expense-nature";
import { calculateSpendComposition } from "@/domain/export/spend-composition";
import { calculateSpendConcentration } from "@/domain/export/concentration";

// buildStatistics 본문 중, currentMonth 계산 이후에 추가:
const currentMonthExpenses = valid.filter((row) => row.type === "EXPENSE" && monthKey(row.transactionAt) === currentMonth);
const withNature = currentMonthExpenses.map((row, index) => ({ id: String(index), baseAmount: row.baseAmount, nature: resolveExpenseNature(row) }));
const spendComposition = calculateSpendComposition(withNature);
const concentrationResult = calculateSpendConcentration(withNature.map(({ id, baseAmount }) => ({ id, baseAmount })));
const byId = new Map(withNature.map((item, index) => [item.id, currentMonthExpenses[index]]));
const concentration = {
  ...concentrationResult,
  topTransactions: concentrationResult.topTransactionIds.map((id) => {
    const row = byId.get(id);
    return { label: row?.categoryName ?? "미분류", baseAmount: row?.baseAmount ?? 0 };
  }),
};
```

`StatisticsOverview` 타입과 반환 객체에 `spendComposition, concentration` 추가. `currentMonth`는 기존 `todayInSeoul(now).slice(0, 7)` 계산을 재사용(이미 파일에 존재하는 지역 변수를 그대로 쓰고, 없다면 함수 상단에 한 줄 추가).

- [ ] **Step 4: repository.ts에 신규 컬럼 select 추가**

`listStatisticsTransactions`의 select 컬럼 목록에 `expense_nature_user,expense_nature_source,planned_transaction_id`를 추가하고, 반환 매핑에 `expenseNatureUser: row.expense_nature_user ?? undefined, expenseNatureSource: row.expense_nature_source ?? undefined, plannedTransactionId: row.planned_transaction_id ?? undefined`를 추가한다.

- [ ] **Step 5: Safe-to-Spend는 대시보드 데이터 재사용**

`src/server/statistics/index.ts`(통계 페이지 진입점)에서 `getSalaryCycle`/`requireCurrentProfile`/`getAssetOverviewForCurrentUser`/`getPlanningOverviewForCurrentUser`를 이미 `src/server/dashboard/index.ts`가 하듯 조합해 `safeToSpend`를 계산한다. 급여일 또는 비상금 미설정 시 `safeToSpend` 필드 자체를 생략한다. (정확한 조합 코드는 `src/server/dashboard/index.ts`의 `cycle`/`remainingDays` 계산과 Task 5의 `calculateSafeToSpend`를 그대로 재사용 — 새 계산식을 만들지 않는다.)

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run tests/unit/statistics-service.test.ts`
Expected: PASS.

- [ ] **Step 7: `StatisticsOverview.tsx` UI 추가**

필수 정보(총 소비, 예외 소비, 일회성 소비, 반복성 소비, 비정기 소비, 미분류 소비, 주요 대형 거래, 지출 집중도)를 상단에 카드로 배치하고, 조정 소비/Safe-to-Spend/일평균 사용 가능 금액은 `<details>` 접이식 영역에 배치한다:

```tsx
<details className="rounded-tile border border-border-subtle p-4">
  <summary className="cursor-pointer text-sm font-medium text-content-secondary">더 보기 (조정 소비 · 사용 가능 금액)</summary>
  <div className="mt-3 flex flex-col gap-2 text-sm text-content-secondary">
    <p>조정 소비(예외 제외): {statistics.spendComposition.adjustedExpenseBaseAmount.toLocaleString()}원</p>
    {statistics.safeToSpend ? (
      <>
        <p>다음 급여일({statistics.safeToSpend.nextPaydayDate})까지 사용 가능 금액: {statistics.safeToSpend.amount.toLocaleString()}원</p>
        <p>일평균 사용 가능 금액(참고): {statistics.safeToSpend.dailyAmount.toLocaleString()}원</p>
      </>
    ) : (
      <p>급여일과 비상금을 설정에서 등록하면 사용 가능 금액을 볼 수 있어요.</p>
    )}
  </div>
</details>
```

상단 필수 카드는 기존 `StatisticsOverview.tsx`의 카드 배치 패턴(파일을 열어 기존 `category`/`tags` breakdown을 그리는 카드 구조)을 그대로 따라, "소비 구조"와 "지출 집중도" 카드를 새로 추가한다.

- [ ] **Step 8: 수동 확인**

Run: `npm run dev`
`/statistics` 페이지 진입 → 소비 구조/집중도가 보이는지, 접이식 영역이 펼쳐지는지, 급여일/비상금 미설정 상태에서 안내 문구가 보이는지 확인.

- [ ] **Step 9: Commit**

```bash
git add src/server/statistics src/components/statistics/StatisticsOverview.tsx tests/unit/statistics-service.test.ts
git commit -m "feat: show spend composition, concentration and safe-to-spend on the statistics page"
```

---

### Task 13: 회귀 테스트 — 전체 스위트 및 시나리오 A~E 확인

**Files:**
- Test 전용 (신규 파일 없음, 기존 스위트 실행)

**Interfaces:** 없음.

- [ ] **Step 1: 유닛 테스트 전체 실행**

Run: `npx vitest run`
Expected: 전체 PASS. 실패 시 Task 3/4/5/11/12에서 만든 함수의 시그니처 불일치(타입명, 필드명)를 우선 확인한다.

- [ ] **Step 2: 통합 테스트 전체 실행**

Run: `npm run test:integration`
Expected: 전체 PASS. 특히 `export.test.ts`, `rls-security-suite.test.ts`, `statistics.test.ts`가 신규 컬럼/필드로 인해 깨지지 않는지 확인.

- [ ] **Step 3: Case A~E 수동 시나리오 재확인**

- Case A: 식비/교통/구독만 있는 달 → `/statistics`에서 소비 구조가 전부 "평소 소비"로만 채워지는지 확인.
- Case B: 식비 200,000 + 교통 100,000 + 가족지원 600,000(EXCEPTIONAL로 수정) → 총 소비 900,000 / 예외 600,000 / 조정 300,000 확인.
- Case C: 평소 300,000 + 키보드 120,000(ONE_TIME) → 공식 소비 420,000 유지, 일회성 120,000 별도 표시 확인.
- Case D: 360,000원 3개월 할부 → 구매월 소비 360,000, 이후 결제월에 추가 소비 없음 확인(기존 할부 회귀).
- Case E: 자산 500,000 / 확정지출 100,000 / 비상금 200,000 / 급여일 20일 남음 → 사용 가능 200,000, 일평균 10,000 확인.

Expected: 5개 시나리오 모두 스펙 문서(`docs/superpowers/specs/2026-08-18-spending-nature-analysis-design.md`) 기대값과 일치.

- [ ] **Step 4: 최종 커밋 없음 확인**

Run: `git status`
Expected: 앞선 Task들에서 이미 모두 커밋되어 있어 추가로 커밋할 변경 사항이 없어야 한다. 남아있다면 위 Task 목록 중 어디에 속하는지 확인 후 해당 Task 커밋 메시지로 커밋한다.
