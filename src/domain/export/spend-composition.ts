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
