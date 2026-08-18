import "server-only";

import { todayInSeoul, toSeoulDate } from "@/lib/dates/seoul";
import { resolveExpenseNature, type ExpenseNatureSource, type ResolvedExpenseNature } from "@/domain/export/expense-nature";
import { calculateSpendComposition, type SpendComposition } from "@/domain/export/spend-composition";
import { calculateSpendConcentration, type SpendConcentration } from "@/domain/export/concentration";

export type StatisticsTransaction = Readonly<{ type: "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT"; status: "PENDING" | "CONFIRMED" | "CANCELLED"; transactionAt: string; baseAmount: number; categoryName?: string; accountName?: string; tagNames: readonly string[]; recurringRuleId?: string; expenseNatureUser?: ResolvedExpenseNature; expenseNatureSource?: ExpenseNatureSource; plannedTransactionId?: string }>;
export type StatisticsPoint = Readonly<{ key: string; income: number; expense: number; value: number }>;
export type StatisticsBreakdown = Readonly<{ name: string; amount: number }>;
export type StatisticsConcentration = SpendConcentration & Readonly<{ topTransactions: readonly Readonly<{ label: string; baseAmount: number }>[] }>;
export type StatisticsSafeToSpend = Readonly<{ amount: number; dailyAmount: number; weeklyAmount: number; nextPaydayDate: string }>;
export type StatisticsOverview = Readonly<{ monthly: readonly StatisticsPoint[]; category: readonly StatisticsBreakdown[]; tags: readonly StatisticsBreakdown[]; paymentMethods: readonly StatisticsBreakdown[]; fixedVariable: readonly StatisticsBreakdown[]; weekday: readonly StatisticsBreakdown[]; weekOfMonth: readonly StatisticsBreakdown[]; monthOverMonth: number | null; savingsRate: number | null; netWorthTrend: readonly Readonly<{ month: string; value: number }>[]; spendComposition: SpendComposition; concentration: StatisticsConcentration; safeToSpend?: StatisticsSafeToSpend }>;
const monthKey = (value: string) => toSeoulDate(value).slice(0, 7);
const add = (map: Map<string, number>, key: string, amount: number) => map.set(key, (map.get(key) ?? 0) + amount);
const breakdown = (map: Map<string, number>) => [...map.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
const weekday = (value: string) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(`${toSeoulDate(value)}T12:00:00+09:00`).getUTCDay()];
export function buildStatistics(transactions: readonly StatisticsTransaction[], currentNetWorth: number, now = new Date()): StatisticsOverview {
  const valid = transactions.filter((row) => row.status === "CONFIRMED" && (row.type === "INCOME" || row.type === "EXPENSE"));
  const monthMap = new Map<string, { income: number; expense: number }>(); const category = new Map<string, number>(); const tags = new Map<string, number>(); const paymentMethods = new Map<string, number>(); const fixedVariable = new Map<string, number>(); const weekdays = new Map<string, number>(); const weeks = new Map<string, number>();
  for (const row of valid) { const key = monthKey(row.transactionAt); const totals = monthMap.get(key) ?? { income: 0, expense: 0 }; if (row.type === "INCOME") totals.income += row.baseAmount; else { totals.expense += row.baseAmount; add(category, row.categoryName ?? "Uncategorized", row.baseAmount); add(paymentMethods, row.accountName ?? "Unspecified", row.baseAmount); add(fixedVariable, row.recurringRuleId ? "Fixed" : "Variable", row.baseAmount); add(weekdays, weekday(row.transactionAt), row.baseAmount); add(weeks, `Week ${Math.min(5, Math.floor((Number(toSeoulDate(row.transactionAt).slice(8, 10)) - 1) / 7) + 1)}`, row.baseAmount); for (const tag of row.tagNames) add(tags, tag, row.baseAmount); } monthMap.set(key, totals); }
  const months = [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([key, x]) => ({ key, income: x.income, expense: x.expense, value: x.income - x.expense })); const current = months.at(-1); const previous = months.at(-2); const mom = current && previous && previous.expense > 0 ? Math.round(((current.expense - previous.expense) / previous.expense) * 100) : null; const savingsRate = current && current.income > 0 ? Math.round(((current.income - current.expense) / current.income) * 100) : null; const currentMonth = todayInSeoul(now).slice(0, 7); const trendMonths = [...new Set([...months.map((point) => point.key), currentMonth])].sort().slice(-6); let runningNetWorth = currentNetWorth; const netWorthTrend = trendMonths.slice().reverse().map((month) => { const point = months.find((entry) => entry.key === month); const value = runningNetWorth; runningNetWorth -= point?.value ?? 0; return { month, value }; }).reverse();

  const currentMonthExpenses = valid.filter((row) => row.type === "EXPENSE" && monthKey(row.transactionAt) === currentMonth);
  const withNature = currentMonthExpenses.map((row, index) => ({ id: String(index), baseAmount: row.baseAmount, nature: resolveExpenseNature(row) }));
  const spendComposition = calculateSpendComposition(withNature);
  const concentrationResult = calculateSpendConcentration(withNature.map(({ id, baseAmount }) => ({ id, baseAmount })));
  const byId = new Map(withNature.map((item, index) => [item.id, currentMonthExpenses[index]]));
  const concentration: StatisticsConcentration = {
    ...concentrationResult,
    topTransactions: concentrationResult.topTransactionIds.map((id) => {
      const row = byId.get(id);
      return { label: row?.categoryName ?? "미분류", baseAmount: row?.baseAmount ?? 0 };
    }),
  };

  return { monthly: months, category: breakdown(category), tags: breakdown(tags), paymentMethods: breakdown(paymentMethods), fixedVariable: breakdown(fixedVariable), weekday: breakdown(weekdays), weekOfMonth: breakdown(weeks), monthOverMonth: mom, savingsRate, netWorthTrend, spendComposition, concentration };
}
