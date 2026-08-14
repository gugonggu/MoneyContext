import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateAccountBalance, type BalanceEvent } from "@/domain/accounts/balance";
import { classifyTransferDirection } from "@/domain/transactions/transfer-direction";
import { toSeoulDate, todayInSeoul } from "@/lib/dates/seoul";
import type { PlanningReadRepository } from "./read-service";

type AccountRow = Readonly<{ id: string; name: string; type: string; initial_balance: number | string; linked_account_id: string | null }>;
type TransactionRow = Readonly<{ type: string; status: string; base_amount: number | string; account_id: string | null; from_account_id: string | null; to_account_id: string | null; transaction_at: string }>;

// Mirrors the balance calculation in server/assets/service.ts - an
// account's current balance is its initial_balance plus every confirmed
// transaction that touched it since (including spending through a linked
// DEBIT card), not just the static initial_balance column.
function accountBalanceEvents(account: AccountRow, transactions: readonly TransactionRow[], accountsById: ReadonlyMap<string, AccountRow>): BalanceEvent[] {
  const events: BalanceEvent[] = [];
  for (const row of transactions) {
    if (row.type === "TRANSFER") {
      if (row.from_account_id === account.id) events.push({ type: "TRANSFER_OUT", amount: Number(row.base_amount) });
      if (row.to_account_id === account.id) events.push({ type: "TRANSFER_IN", amount: Number(row.base_amount) });
      continue;
    }
    if (row.type !== "INCOME" && row.type !== "EXPENSE" && row.type !== "ADJUSTMENT") continue;
    const directEvent: BalanceEvent = { type: row.type, amount: Number(row.base_amount) };
    if (row.account_id === account.id) events.push(directEvent);
    const paymentMethod = row.account_id ? accountsById.get(row.account_id) : undefined;
    if (paymentMethod?.type === "DEBIT" && paymentMethod.linked_account_id === account.id) events.push(directEvent);
  }
  return events;
}

// A TRANSFER with only one side present is money sent outside the tracked
// accounts (e.g. paying a friend back) - it counts as budget usage same as a
// real EXPENSE would.
function isEffectiveExpense(row: Readonly<{ type: string; from_account_id: string | null; to_account_id: string | null }>): boolean {
  if (row.type === "EXPENSE") return true;
  if (row.type === "TRANSFER") return classifyTransferDirection(row.from_account_id, row.to_account_id) === "EXPENSE";
  return false;
}

export function createPlanningReadRepository(supabase: SupabaseClient): PlanningReadRepository {
  return { async getData(userId) {
    const today = todayInSeoul();
    const currentMonth = today.slice(0, 7);
    const [year, month] = currentMonth.split("-").map(Number);
    const [accounts, transactions, planned, recurring, goals, contributions, monthlyBudget] = await Promise.all([
      supabase.from("accounts").select("id,name,type,initial_balance,linked_account_id").eq("user_id", userId).eq("is_active", true),
      supabase.from("transactions").select("type,status,transaction_at,base_amount,account_id,from_account_id,to_account_id").eq("user_id", userId).eq("status", "CONFIRMED"),
      supabase.from("planned_transactions").select("id,type,status,scheduled_date,base_amount,amount,memo").eq("user_id", userId).eq("status", "PLANNED"),
      supabase.from("recurring_transactions").select("id,type,amount,next_run_date,memo").eq("user_id", userId).eq("is_active", true),
      supabase.from("savings_goals").select("id,name,target_amount,monthly_contribution_plan").eq("user_id", userId).eq("is_active", true),
      supabase.from("savings_contributions").select("goal_id,amount").eq("user_id", userId),
      supabase.from("monthly_budgets").select("total_budget").eq("user_id", userId).eq("year", year).eq("month", month).maybeSingle(),
    ]);
    for (const result of [accounts, transactions, planned, recurring, goals, contributions, monthlyBudget]) if (result.error) throw new Error(result.error.message);
    const accountRows = (accounts.data ?? []) as AccountRow[];
    const transactionRows = (transactions.data ?? []) as TransactionRow[];
    const accountsById = new Map(accountRows.map((account) => [account.id, account]));
    const liquidAssets = accountRows
      .filter((account) => account.type === "BANK" || account.type === "CASH")
      .reduce((sum, account) => sum + calculateAccountBalance(Number(account.initial_balance), accountBalanceEvents(account, transactionRows, accountsById)), 0);
    const monthlyBudgetTotal = monthlyBudget.data ? Number(monthlyBudget.data.total_budget) : null;
    // "Actual usage" is this month's spending against this month's budget -
    // not every confirmed expense the account has ever recorded.
    const expenses = transactionRows
      .filter((row) => isEffectiveExpense(row) && toSeoulDate(row.transaction_at).slice(0, 7) === currentMonth)
      .map((row) => ({ amount: Number(row.base_amount), status: row.status as "CONFIRMED" }));
    const plannedExpenseRows = (planned.data ?? []).filter((row) => row.type === "EXPENSE");
    // Forecast usage only folds in this month's remaining planned expenses -
    // deductions below still uses every planned row for the separate
    // all-future "여유 지출액" cash-runway calculation.
    const plannedExpenses = plannedExpenseRows
      .filter((row) => row.scheduled_date.slice(0, 7) === currentMonth)
      .map((row) => Number(row.base_amount ?? row.amount));
    const accountTypes = new Map((accounts.data ?? []).map((account) => [account.id, account.type]));
    const cardOutstanding = new Map<string, number>();
    for (const row of transactions.data ?? []) {
      if (row.type === "EXPENSE" && row.account_id && accountTypes.get(row.account_id) === "CREDIT_CARD") cardOutstanding.set(row.account_id, (cardOutstanding.get(row.account_id) ?? 0) + Number(row.base_amount));
      if (row.type === "TRANSFER" && row.to_account_id && accountTypes.get(row.to_account_id) === "CREDIT_CARD") cardOutstanding.set(row.to_account_id, (cardOutstanding.get(row.to_account_id) ?? 0) - Number(row.base_amount));
    }
    const deductions = [
      ...plannedExpenseRows.map((row) => ({
        id: row.id,
        label: row.memo?.trim() || "예정 지출",
        amount: Number(row.base_amount ?? row.amount),
        provenance: `planned:${row.id}`,
        status: "PLANNED" as const,
      })),
      ...(recurring.data ?? []).filter((row) => row.type === "EXPENSE").map((row) => ({
        id: row.id,
        label: row.memo?.trim() || "반복 지출",
        amount: Number(row.amount),
        provenance: `recurring:${row.id}`,
        status: "PLANNED" as const,
      })),
      ...(goals.data ?? []).filter((goal) => Number(goal.monthly_contribution_plan) > 0).map((goal) => ({
        id: goal.id,
        label: `${goal.name} 저축`,
        amount: Number(goal.monthly_contribution_plan),
        provenance: `savings:${goal.id}`,
        status: "PLANNED" as const,
      })),
      ...Array.from(cardOutstanding.entries()).filter(([, amount]) => amount > 0).map(([cardId, amount]) => ({
        id: cardId,
        label: `${(accounts.data ?? []).find((account) => account.id === cardId)?.name ?? "신용카드"} 카드대금`,
        amount,
        provenance: `card:${cardId}`,
        status: "CONFIRMED" as const,
      })),
    ];
    return { liquidAssets, monthlyBudgetTotal, expenses, plannedExpenses, goals: (goals.data ?? []).map((goal) => ({ id: goal.id, name: goal.name, targetAmount: Number(goal.target_amount), monthlyContributionPlan: Number(goal.monthly_contribution_plan) })), contributions: (contributions.data ?? []).map((row) => ({ goalId: row.goal_id, amount: Number(row.amount) })), deductions };
  } };
}
