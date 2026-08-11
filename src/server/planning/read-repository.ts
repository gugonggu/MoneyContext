import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanningReadRepository } from "./read-service";

export function createPlanningReadRepository(supabase: SupabaseClient): PlanningReadRepository {
  return { async getData(userId) {
    const [accounts, transactions, planned, recurring, goals, contributions] = await Promise.all([
      supabase.from("accounts").select("id,type,initial_balance").eq("user_id", userId).eq("is_active", true),
      supabase.from("transactions").select("type,status,base_amount,account_id,to_account_id").eq("user_id", userId).eq("status", "CONFIRMED"),
      supabase.from("planned_transactions").select("id,type,status,scheduled_date,base_amount,amount").eq("user_id", userId).eq("status", "PLANNED"),
      supabase.from("recurring_transactions").select("id,type,amount,next_run_date").eq("user_id", userId).eq("is_active", true),
      supabase.from("savings_goals").select("id,name,target_amount,monthly_contribution_plan").eq("user_id", userId).eq("is_active", true),
      supabase.from("savings_contributions").select("goal_id,amount").eq("user_id", userId),
    ]);
    for (const result of [accounts, transactions, planned, recurring, goals, contributions]) if (result.error) throw new Error(result.error.message);
    const liquidAssets = (accounts.data ?? []).filter((account) => account.type === "BANK" || account.type === "CASH").reduce((sum, account) => sum + Number(account.initial_balance), 0);
    const expenses = (transactions.data ?? []).filter((row) => row.type === "EXPENSE").map((row) => ({ amount: Number(row.base_amount), status: row.status as "CONFIRMED" }));
    const plannedExpenses = (planned.data ?? []).filter((row) => row.type === "EXPENSE").map((row) => Number(row.base_amount ?? row.amount));
    const accountTypes = new Map((accounts.data ?? []).map((account) => [account.id, account.type]));
    const cardOutstanding = new Map<string, number>();
    for (const row of transactions.data ?? []) {
      if (row.type === "EXPENSE" && row.account_id && accountTypes.get(row.account_id) === "CREDIT_CARD") cardOutstanding.set(row.account_id, (cardOutstanding.get(row.account_id) ?? 0) + Number(row.base_amount));
      if (row.type === "TRANSFER" && row.to_account_id && accountTypes.get(row.to_account_id) === "CREDIT_CARD") cardOutstanding.set(row.to_account_id, (cardOutstanding.get(row.to_account_id) ?? 0) - Number(row.base_amount));
    }
    const deductions = [
      ...plannedExpenses.map((amount, index) => ({ amount, provenance: `planned:${planned.data?.[index]?.id ?? index}` })),
      ...(recurring.data ?? []).filter((row) => row.type === "EXPENSE").map((row) => ({ amount: Number(row.amount), provenance: `recurring:${row.id}` })),
      ...(goals.data ?? []).filter((goal) => Number(goal.monthly_contribution_plan) > 0).map((goal) => ({ amount: Number(goal.monthly_contribution_plan), provenance: `savings:${goal.id}` })),
      ...Array.from(cardOutstanding.entries()).filter(([, amount]) => amount > 0).map(([cardId, amount]) => ({ amount, provenance: `card:${cardId}` })),
    ];
    return { liquidAssets, expenses, plannedExpenses, goals: (goals.data ?? []).map((goal) => ({ id: goal.id, name: goal.name, targetAmount: Number(goal.target_amount), monthlyContributionPlan: Number(goal.monthly_contribution_plan) })), contributions: (contributions.data ?? []).map((row) => ({ goalId: row.goal_id, amount: Number(row.amount) })), deductions };
  } };
}
