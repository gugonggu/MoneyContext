export type ForecastDeduction = Readonly<{ amount: number; provenance: string }>;

export function aggregateRequiredCashflow(items: readonly ForecastDeduction[]): number {
  const seen = new Set<string>();
  return items.reduce((total, item) => {
    if (seen.has(item.provenance)) return total;
    seen.add(item.provenance);
    return total + item.amount;
  }, 0);
}

export function calculateFreeSpendable(liquidAssets: number, deductions: readonly ForecastDeduction[]): number {
  return liquidAssets - aggregateRequiredCashflow(deductions);
}

export function calculateDailySpendable(freeSpendable: number, remainingDays: number): number {
  return remainingDays > 0 ? Math.floor(Math.max(0, freeSpendable) / remainingDays) : 0;
}

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
