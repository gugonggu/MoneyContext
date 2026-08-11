import "server-only";

import { calculateActualBudgetUsage, calculateForecastBudgetUsage } from "@/domain/budgets/usage";
import { calculateFreeSpendable, type ForecastDeduction } from "@/domain/forecasts/spendable";
import { calculateRemainingSavings, calculateRequiredMonthlySavings } from "@/domain/savings/projection";

type Goal = Readonly<{ id: string; name: string; targetAmount: number; monthlyContributionPlan: number }>;
type Contribution = Readonly<{ goalId: string; amount: number }>;
export interface PlanningReadRepository {
  getData(userId: string): Promise<Readonly<{
    liquidAssets: number;
    expenses: readonly Readonly<{ amount: number; status: "CONFIRMED" | "PENDING" | "CANCELLED" }>[];
    plannedExpenses: readonly number[];
    goals: readonly Goal[];
    contributions: readonly Contribution[];
    deductions: readonly ForecastDeduction[];
  }>>;
}

export function createPlanningReadService(repository: PlanningReadRepository) {
  return { getOverview: async (userId: string) => {
    const data = await repository.getData(userId);
    const actualUsage = calculateActualBudgetUsage(data.expenses);
    return {
      budget: { actualUsage, forecastUsage: calculateForecastBudgetUsage(actualUsage, data.plannedExpenses) },
      goals: data.goals.map((goal) => {
        const contributedAmount = data.contributions.filter((item) => item.goalId === goal.id).reduce((sum, item) => sum + item.amount, 0);
        const remainingAmount = calculateRemainingSavings(goal.targetAmount, contributedAmount);
        return { id: goal.id, name: goal.name, contributedAmount, remainingAmount, requiredMonthlyAmount: calculateRequiredMonthlySavings(remainingAmount, 0) };
      }),
      freeSpendable: calculateFreeSpendable(data.liquidAssets, data.deductions),
      futureCashflowCount: data.deductions.length,
    };
  } };
}
