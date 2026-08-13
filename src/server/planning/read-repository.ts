import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanningReadRepository } from "./read-service";

export function createPlanningReadRepository(supabase: SupabaseClient): PlanningReadRepository {
  return { async getData(userId) {
    const [accounts, transactions, planned, recurring, goals, contributions] = await Promise.all([
      supabase.from("accounts").select("id,name,type,initial_balance").eq("user_id", userId).eq("is_active", true),
      supabase.from("transactions").select("type,status,base_amount,account_id,to_account_id").eq("user_id", userId).eq("status", "CONFIRMED"),
      supabase.from("planned_transactions").select("id,type,status,scheduled_date,base_amount,amount,memo").eq("user_id", userId).eq("status", "PLANNED"),
      supabase.from("recurring_transactions").select("id,type,amount,next_run_date,memo").eq("user_id", userId).eq("is_active", true),
      supabase.from("savings_goals").select("id,name,target_amount,monthly_contribution_plan").eq("user_id", userId).eq("is_active", true),
      supabase.from("savings_contributions").select("goal_id,amount").eq("user_id", userId),
    ]);
    for (const result of [accounts, transactions, planned, recurring, goals, contributions]) if (result.error) throw new Error(result.error.message);
    const liquidAssets = (accounts.data ?? []).filter((account) => account.type === "BANK" || account.type === "CASH").reduce((sum, account) => sum + Number(account.initial_balance), 0);
    const expenses = (transactions.data ?? []).filter((row) => row.type === "EXPENSE").map((row) => ({ amount: Number(row.base_amount), status: row.status as "CONFIRMED" }));
    const plannedExpenseRows = (planned.data ?? []).filter((row) => row.type === "EXPENSE");
    const plannedExpenses = plannedExpenseRows.map((row) => Number(row.base_amount ?? row.amount));
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
    return { liquidAssets, expenses, plannedExpenses, goals: (goals.data ?? []).map((goal) => ({ id: goal.id, name: goal.name, targetAmount: Number(goal.target_amount), monthlyContributionPlan: Number(goal.monthly_contribution_plan) })), contributions: (contributions.data ?? []).map((row) => ({ goalId: row.goal_id, amount: Number(row.amount) })), deductions };
  } };
}
