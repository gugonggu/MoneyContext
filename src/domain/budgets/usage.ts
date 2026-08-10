export type BudgetExpense = Readonly<{ amount: number; status: "CONFIRMED" | "PENDING" | "CANCELLED" }>;

export function calculateActualBudgetUsage(expenses: readonly BudgetExpense[]): number {
  return expenses.filter((expense) => expense.status === "CONFIRMED").reduce((total, expense) => total + expense.amount, 0);
}

export function calculateRollover(availableBudget: number, actualUsage: number): number {
  return availableBudget - actualUsage;
}

export function calculateForecastBudgetUsage(actualUsage: number, plannedExpenses: readonly number[]): number {
  return actualUsage + plannedExpenses.reduce((total, amount) => total + amount, 0);
}
