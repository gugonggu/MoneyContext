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
