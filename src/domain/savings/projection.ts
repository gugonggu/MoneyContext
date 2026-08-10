export function calculateRemainingSavings(targetAmount: number, contributedAmount: number): number {
  return Math.max(0, targetAmount - contributedAmount);
}

export function calculateRequiredMonthlySavings(remainingAmount: number, remainingContributions: number): number {
  if (remainingContributions <= 0) return remainingAmount;
  return Math.ceil(remainingAmount / remainingContributions);
}
