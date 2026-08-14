import "server-only";
import { getAssetOverviewForCurrentUser } from "@/server/assets";
import { getPlanningOverviewForCurrentUser } from "@/server/planning";
import { listTransactionsForCurrentUser } from "@/server/transactions";
import { requireCurrentProfile } from "@/server/auth/require-profile";
import { classifyTransferDirection } from "@/domain/transactions/transfer-direction";
import { getSalaryCycle } from "@/lib/dates/salary-cycle";
import { addIsoDays, todayInSeoul, toSeoulDate } from "@/lib/dates/seoul";
import { buildRecentDashboardDays, createDashboardService } from "./service";

function countInclusiveDays(start: string, end: string): number {
  let count = 1;
  for (let date = start; date < end; date = addIsoDays(date, 1)) count += 1;
  return count;
}

// A TRANSFER with only one side present is money sent to or received from
// outside the tracked accounts (e.g. paying a friend back) - it counts toward
// this cycle's income/expense same as a real transaction would.
function effectiveType(transaction: Readonly<{ type: string; fromAccountId?: string; toAccountId?: string }>): "INCOME" | "EXPENSE" | undefined {
  if (transaction.type === "INCOME" || transaction.type === "EXPENSE") return transaction.type;
  if (transaction.type === "TRANSFER") return classifyTransferDirection(transaction.fromAccountId, transaction.toAccountId);
  return undefined;
}

export async function getDashboardOverviewForCurrentUser() {
  const [profile, assets, planning, transactions] = await Promise.all([
    requireCurrentProfile(),
    getAssetOverviewForCurrentUser(),
    getPlanningOverviewForCurrentUser(),
    listTransactionsForCurrentUser(),
  ]);
  const today = todayInSeoul();
  const cycle = getSalaryCycle(today, profile.salary_cycle_day);
  const confirmedTransactions = transactions.filter((transaction) => transaction.status === "CONFIRMED");
  const cycleTransactions = confirmedTransactions.filter((transaction) => {
    const date = toSeoulDate(transaction.transactionAt);
    return date >= cycle.start && date <= cycle.end;
  });
  const income = cycleTransactions.filter((transaction) => effectiveType(transaction) === "INCOME").reduce((sum, transaction) => sum + transaction.baseAmount, 0);
  const expense = cycleTransactions.filter((transaction) => effectiveType(transaction) === "EXPENSE").reduce((sum, transaction) => sum + transaction.baseAmount, 0);
  const remainingDays = countInclusiveDays(today, cycle.end);
  const recentDays = buildRecentDashboardDays(today, confirmedTransactions);

  return createDashboardService({
    getData: async () => ({
      freeSpendable: planning.freeSpendable,
      dailySpendable: Math.floor(Math.max(0, planning.freeSpendable) / remainingDays),
      liquidAssets: assets.liquidAssets,
      netWorth: assets.netWorth,
      cardOutstanding: assets.cards.reduce((sum, card) => sum + card.outstanding, 0),
      income,
      expense,
      budgetUsage: planning.budget.actualUsage,
      savingsGoals: planning.goals.length,
      upcomingEvents: planning.futureCashflowCount,
      recentDays,
    }),
  }).getOverview(profile.id);
}
