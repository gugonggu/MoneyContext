export function calculateRemainingSavings(targetAmount: number, contributedAmount: number): number {
  return Math.max(0, targetAmount - contributedAmount);
}

export function calculateRequiredMonthlySavings(remainingAmount: number, remainingContributions: number): number {
  if (remainingContributions <= 0) return remainingAmount;
  return Math.ceil(remainingAmount / remainingContributions);
}

export type SavingsProjectionStatus = "ACHIEVED" | "ON_TRACK" | "AT_RISK" | "OVERDUE";

export function projectSavingsGoal(input: Readonly<{
  targetAmount: number;
  contributedAmount: number;
  targetDate: string;
  monthlyContributionPlan: number;
  today: string;
}>): Readonly<{ remainingAmount: number; remainingContributions: number; requiredMonthlyAmount: number; status: SavingsProjectionStatus }> {
  const remainingAmount = calculateRemainingSavings(input.targetAmount, input.contributedAmount);
  const [targetYear, targetMonth] = input.targetDate.split("-").map(Number);
  const [todayYear, todayMonth] = input.today.split("-").map(Number);
  const remainingContributions = Math.max(0, (targetYear - todayYear) * 12 + targetMonth - todayMonth);
  const requiredMonthlyAmount = calculateRequiredMonthlySavings(remainingAmount, remainingContributions);
  const status: SavingsProjectionStatus = remainingAmount === 0
    ? "ACHIEVED"
    : input.targetDate < input.today
      ? "OVERDUE"
      : input.monthlyContributionPlan < requiredMonthlyAmount ? "AT_RISK" : "ON_TRACK";
  return { remainingAmount, remainingContributions, requiredMonthlyAmount, status };
}
