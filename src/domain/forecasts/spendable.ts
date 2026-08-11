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
