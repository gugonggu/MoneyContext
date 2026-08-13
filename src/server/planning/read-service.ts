import "server-only";

import { calculateActualBudgetUsage, calculateForecastBudgetUsage } from "@/domain/budgets/usage";
import { calculateFreeSpendable, type ForecastDeduction } from "@/domain/forecasts/spendable";
import { calculateRemainingSavings, calculateRequiredMonthlySavings, calculateSavingsProgressRatio } from "@/domain/savings/projection";

type Goal = Readonly<{ id: string; name: string; targetAmount: number; monthlyContributionPlan: number }>;
type Contribution = Readonly<{ goalId: string; amount: number }>;
export type PlanningCashflowStatus = "CONFIRMED" | "PLANNED";
export type PlanningForecastDeduction = ForecastDeduction & Readonly<{
  id: string;
  label: string;
  status: PlanningCashflowStatus;
}>;

function uniqueCashflows(deductions: readonly PlanningForecastDeduction[]) {
  const seen = new Set<string>();
  return deductions.flatMap((item) => {
    if (seen.has(item.provenance)) return [];
    seen.add(item.provenance);
    return [{ id: item.id, label: item.label, amount: item.amount, status: item.status }];
  });
}

export interface PlanningReadRepository {
  getData(userId: string): Promise<Readonly<{
    liquidAssets: number;
    expenses: readonly Readonly<{ amount: number; status: "CONFIRMED" | "PENDING" | "CANCELLED" }>[];
    plannedExpenses: readonly number[];
    goals: readonly Goal[];
    contributions: readonly Contribution[];
    deductions: readonly PlanningForecastDeduction[];
  }>>;
}

export function createPlanningReadService(repository: PlanningReadRepository) {
  return { getOverview: async (userId: string) => {
    const data = await repository.getData(userId);
    const actualUsage = calculateActualBudgetUsage(data.expenses);
    const futureCashflows = uniqueCashflows(data.deductions);
    return {
      budget: { actualUsage, forecastUsage: calculateForecastBudgetUsage(actualUsage, data.plannedExpenses) },
      goals: data.goals.map((goal) => {
        const contributedAmount = data.contributions.filter((item) => item.goalId === goal.id).reduce((sum, item) => sum + item.amount, 0);
        const remainingAmount = calculateRemainingSavings(goal.targetAmount, contributedAmount);
        return {
          id: goal.id,
          name: goal.name,
          contributedAmount,
          remainingAmount,
          requiredMonthlyAmount: calculateRequiredMonthlySavings(remainingAmount, 0),
          progressPercent: Math.round(calculateSavingsProgressRatio(contributedAmount, remainingAmount) * 100),
        };
      }),
      freeSpendable: calculateFreeSpendable(data.liquidAssets, data.deductions),
      futureCashflowCount: futureCashflows.length,
      futureCashflows,
    };
  } };
}
