import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ExportTransaction } from "@/domain/export/markdown";
import type { ExportPeriod } from "@/domain/export/period";
import { createAssetReadRepository } from "@/server/assets/repository";
import { createAssetReadService } from "@/server/assets/service";

import type { ExportReadData, ExportReadRepository } from "./service";

type TransactionRow = Readonly<{
  id: string;
  transaction_at: string;
  type: ExportTransaction["type"];
  status: ExportTransaction["status"];
  amount: number | string;
  currency: string;
  base_amount: number | string;
  memo: string | null;
  categories: { name: string } | { name: string }[] | null;
  accounts: { name: string } | { name: string }[] | null;
  transaction_tags: Array<{ tags: { name: string } | { name: string }[] | null }> | null;
}>;

type ProfileRow = Readonly<{ base_currency: string }>;
type MonthlyBudgetRow = Readonly<{ year: number | string; month: number | string; total_budget: number | string }>;
type CategoryBudgetRow = Readonly<{
  year: number | string;
  month: number | string;
  base_budget: number | string;
  rollover_amount: number | string;
  categories: { name: string } | { name: string }[] | null;
}>;
type PlannedRow = Readonly<{ scheduled_date: string; type: "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT"; status: "PLANNED" | "CONFIRMED" | "CANCELLED"; amount: number | string; base_amount: number | string | null; memo: string | null }>;
type GoalRow = Readonly<{ id: string; name: string; target_amount: number | string; target_date: string }>;
type ContributionRow = Readonly<{ goal_id: string; amount: number | string }>;

function one<T>(value: T | readonly T[] | null): T | undefined {
  return (Array.isArray(value) ? value[0] : value) as T | undefined;
}

function asSafeInteger(value: number | string, field: string): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount)) throw new RangeError(`${field} must be a safe integer`);
  return amount;
}

function seoulDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError("transaction_at must be a valid date-time");
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: "year" | "month" | "day") => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function nextSeoulDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

function periodMonths(period: ExportPeriod): readonly string[] {
  const [startYear, startMonth] = period.startDate.slice(0, 7).split("-").map(Number);
  const [endYear, endMonth] = period.endDate.slice(0, 7).split("-").map(Number);
  const months: string[] = [];
  for (let index = startYear * 12 + startMonth - 1; index <= endYear * 12 + endMonth - 1; index += 1) {
    months.push(`${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`);
  }
  return months;
}

function mapTransaction(row: TransactionRow): ExportTransaction {
  const category = one(row.categories);
  const account = one(row.accounts);
  const tagNames = (row.transaction_tags ?? []).flatMap((link) => {
    const tag = one(link.tags);
    return tag ? [tag.name] : [];
  });
  return {
    id: row.id,
    transactionDate: row.transaction_at,
    type: row.type,
    status: row.status,
    originalAmount: asSafeInteger(row.amount, "transaction amount"),
    originalCurrency: row.currency,
    baseAmount: asSafeInteger(row.base_amount, "transaction base_amount"),
    ...(category ? { categoryName: category.name } : {}),
    ...(account ? { accountName: account.name } : {}),
    ...(tagNames.length > 0 ? { tagNames } : {}),
    ...(row.memo === null ? {} : { memo: row.memo }),
  };
}

function isActualExpense(transaction: ExportTransaction): boolean {
  return transaction.type === "EXPENSE" && transaction.status === "CONFIRMED";
}

function isPlannedIncomeOrExpense(row: PlannedRow): row is PlannedRow & Readonly<{ type: "INCOME" | "EXPENSE" }> {
  return row.type === "INCOME" || row.type === "EXPENSE";
}

function errorOr<T>(result: Readonly<{ data: T | null; error: { message: string } | null }>): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("export data was not found");
  return result.data;
}

export function createExportRepository(supabase: SupabaseClient): ExportReadRepository {
  const assetService = createAssetReadService(createAssetReadRepository(supabase));
  return {
    async getReadData(userId, period): Promise<ExportReadData> {
      const nextDate = nextSeoulDate(period.endDate);
      const [profileResult, transactionResult, monthlyBudgetResult, categoryBudgetResult, plannedResult, goalResult, contributionResult, assets] = await Promise.all([
        supabase.from("profiles").select("base_currency").eq("id", userId).maybeSingle(),
        supabase.from("transactions").select("id,transaction_at,type,status,amount,currency,base_amount,memo,categories(name),accounts!transactions_account_id_fkey(name),transaction_tags(tags(name))").eq("user_id", userId).gte("transaction_at", `${period.startDate}T00:00:00+09:00`).lt("transaction_at", `${nextDate}T00:00:00+09:00`).order("transaction_at"),
        supabase.from("monthly_budgets").select("year,month,total_budget").eq("user_id", userId),
        supabase.from("category_budgets").select("year,month,base_budget,rollover_amount,categories(name)").eq("user_id", userId),
        supabase.from("planned_transactions").select("scheduled_date,type,status,amount,base_amount,memo").eq("user_id", userId).gte("scheduled_date", period.startDate).lte("scheduled_date", period.endDate),
        supabase.from("savings_goals").select("id,name,target_amount,target_date").eq("user_id", userId).eq("is_active", true).order("target_date"),
        supabase.from("savings_contributions").select("goal_id,amount").eq("user_id", userId),
        assetService.getOverview(userId),
      ]);
      const profile = errorOr(profileResult as { data: ProfileRow | null; error: { message: string } | null });
      const transactionRows = errorOr(transactionResult as { data: TransactionRow[] | null; error: { message: string } | null });
      const monthlyBudgets = errorOr(monthlyBudgetResult as { data: MonthlyBudgetRow[] | null; error: { message: string } | null });
      const categoryBudgets = errorOr(categoryBudgetResult as { data: CategoryBudgetRow[] | null; error: { message: string } | null });
      const plannedRows = errorOr(plannedResult as { data: PlannedRow[] | null; error: { message: string } | null });
      const goals = errorOr(goalResult as { data: GoalRow[] | null; error: { message: string } | null });
      const contributions = errorOr(contributionResult as { data: ContributionRow[] | null; error: { message: string } | null });
      const transactions = transactionRows.map(mapTransaction);
      const months = new Set(periodMonths(period));
      const expenses = transactions.filter(isActualExpense);
      const totalByMonth = new Map<string, number>();
      const categoryByMonth = new Map<string, number>();
      for (const expense of expenses) {
        const month = seoulDate(expense.transactionDate).slice(0, 7);
        totalByMonth.set(month, (totalByMonth.get(month) ?? 0) + expense.baseAmount);
        const key = `${month}\u0000${expense.categoryName ?? "Uncategorized"}`;
        categoryByMonth.set(key, (categoryByMonth.get(key) ?? 0) + expense.baseAmount);
      }
      const budgets = [
        ...monthlyBudgets.filter((budget) => months.has(`${budget.year}-${String(budget.month).padStart(2, "0")}`)).map((budget) => {
          const month = `${budget.year}-${String(budget.month).padStart(2, "0")}`;
          return { name: `${month} total`, allocatedBaseAmount: asSafeInteger(budget.total_budget, "monthly budget"), actualUsageBaseAmount: totalByMonth.get(month) ?? 0 };
        }),
        ...categoryBudgets.filter((budget) => months.has(`${budget.year}-${String(budget.month).padStart(2, "0")}`)).map((budget) => {
          const month = `${budget.year}-${String(budget.month).padStart(2, "0")}`;
          const categoryName = one(budget.categories)?.name ?? "Uncategorized";
          return { name: `${month} ${categoryName}`, allocatedBaseAmount: asSafeInteger(budget.base_budget, "category budget") + asSafeInteger(budget.rollover_amount, "category rollover"), actualUsageBaseAmount: categoryByMonth.get(`${month}\u0000${categoryName}`) ?? 0 };
        }),
      ];
      const contributedByGoal = new Map<string, number>();
      for (const contribution of contributions) {
        contributedByGoal.set(contribution.goal_id, (contributedByGoal.get(contribution.goal_id) ?? 0) + asSafeInteger(contribution.amount, "savings contribution"));
      }
      return {
        baseCurrency: profile.base_currency,
        financialPosition: {
          totalAssets: Math.max(assets.liquidAssets, 0),
          totalLiabilities: assets.liabilities + Math.max(-assets.liquidAssets, 0),
          creditCardOutstanding: assets.cards.reduce((total, card) => total + card.outstanding, 0),
          netWorth: assets.netWorth,
        },
        transactions,
        budgets,
        plannedCashflows: plannedRows.filter(isPlannedIncomeOrExpense).map((row) => ({ scheduledDate: row.scheduled_date, type: row.type, status: row.status, baseAmount: asSafeInteger(row.base_amount ?? row.amount, "planned base_amount"), ...(row.memo === null ? {} : { memo: row.memo }) })),
        savingsGoals: goals.map((goal) => ({ name: goal.name, targetBaseAmount: asSafeInteger(goal.target_amount, "savings target"), contributedBaseAmount: contributedByGoal.get(goal.id) ?? 0, targetDate: goal.target_date })),
        creditCards: assets.cards.map((card) => ({ name: card.name, outstandingBaseAmount: card.outstanding, nextPaymentDate: card.nextPaymentDate })),
      };
    },
  };
}
