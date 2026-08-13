import "server-only";

import { aggregateDailyTotals, heatLevels, type SourceTransaction } from "@/domain/calendar/month";
import type { DashboardDay } from "@/domain/calendar/types";
import { addIsoDays } from "@/lib/dates/seoul";

export type DashboardData = Readonly<{ freeSpendable: number; dailySpendable: number; liquidAssets: number; netWorth: number; cardOutstanding: number; income: number; expense: number; budgetUsage: number; savingsGoals: number; upcomingEvents: number; recentDays: readonly DashboardDay[] }>;
export interface DashboardRepository { getData(userId: string): Promise<DashboardData>; }
export function createDashboardService(repository: DashboardRepository) { return { getOverview: (userId: string) => repository.getData(userId) }; }

export function buildRecentDashboardDays(
  today: string,
  transactions: readonly SourceTransaction[],
): readonly DashboardDay[] {
  const start = addIsoDays(today, -13);
  const allTotals = aggregateDailyTotals(transactions);
  const totals = new Map([...allTotals].filter(([date]) => date >= start && date <= today));
  const levels = heatLevels(new Map([...totals].map(([date, value]) => [date, value.expense])));

  return Array.from({ length: 14 }, (_, index) => {
    const date = addIsoDays(start, index);
    const dayTotals = totals.get(date) ?? { income: 0, expense: 0 };
    return {
      date,
      income: dayTotals.income,
      expense: dayTotals.expense,
      heatLevel: levels.get(date) ?? 0,
    };
  });
}
