export type ForecastDeduction = Readonly<{ amount: number; provenance: string }>;

export function calculateFreeSpendable(liquidAssets: number, deductions: readonly ForecastDeduction[]): number {
  const seen = new Set<string>();
  const total = deductions.reduce((sum, item) => {
    if (seen.has(item.provenance)) return sum;
    seen.add(item.provenance);
    return sum + item.amount;
  }, 0);
  return liquidAssets - total;
}

export function calculateDailySpendable(freeSpendable: number, remainingDays: number): number {
  return remainingDays > 0 ? Math.floor(Math.max(0, freeSpendable) / remainingDays) : 0;
}
