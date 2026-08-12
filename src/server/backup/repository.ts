import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { BackupReadData, BackupRepository } from "./service";

type QueryResult<T> = { data: T | null; error: { message: string } | null };
type Row = Record<string, unknown>;
type PageQuery = PromiseLike<QueryResult<Row[]>>;

const PAGE_SIZE = 1000;

function result<T>(query: QueryResult<T>): T {
  if (query.error) throw new Error(query.error.message);
  if (query.data === null) throw new Error("backup data was not found");
  return query.data;
}

function integer(value: unknown, field: string): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(number)) throw new Error(`${field} must be a safe integer`);
  return number;
}

function nullableInteger(value: unknown, field: string): number | null {
  return value === null ? null : integer(value, field);
}

function numericRows<T extends Record<string, unknown>>(rows: T[], fields: readonly string[]): T[] {
  return rows.map((row) => {
    const mapped: Record<string, unknown> = { ...row };
    for (const field of fields) mapped[field] = nullableInteger(mapped[field], field);
    return mapped as T;
  });
}

function page(query: unknown): PageQuery {
  return query as PageQuery;
}

async function allRows(loadPage: (from: number, to: number) => PageQuery): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const current = result(await loadPage(from, from + PAGE_SIZE - 1));
    rows.push(...current);
    if (current.length < PAGE_SIZE) return rows;
  }
}

export function createBackupRepository(supabase: SupabaseClient): BackupRepository {
  return {
    async getBackupData(userId): Promise<BackupReadData> {
      const [profileResult, accountsResult, cardSettingsResult, categoriesResult, tagsResult, transactionsResult, transactionTagsResult, recurringResult, plannedResult, plansResult, paymentsResult, monthlyBudgetsResult, categoryBudgetsResult, savingsGoalsResult, savingsContributionsResult] = await Promise.all([
        supabase.from("profiles").select("id,display_name,base_currency,salary_cycle_day,timezone,onboarding_completed").eq("id", userId).maybeSingle(),
        allRows((from, to) => page(supabase.from("accounts").select("id,user_id,name,type,initial_balance,linked_account_id,is_active,sort_order").eq("user_id", userId).order("id").range(from, to))),
        allRows((from, to) => page(supabase.from("credit_card_settings").select("id,user_id,account_id,payment_day,payment_account_id,credit_limit,billing_cycle_start_offset,billing_cycle_end_offset,billing_cycle_rule").eq("user_id", userId).order("id").range(from, to))),
        allRows((from, to) => page(supabase.from("categories").select("id,user_id,name,kind,is_system_default,is_active,sort_order").eq("user_id", userId).order("id").range(from, to))),
        allRows((from, to) => page(supabase.from("tags").select("id,user_id,name,is_active").eq("user_id", userId).order("id").range(from, to))),
        allRows((from, to) => page(supabase.from("transactions").select("id,user_id,type,status,transaction_at,amount,currency,base_amount,base_currency,exchange_rate,category_id,account_id,from_account_id,to_account_id,memo,recurring_rule_id,recurring_occurrence_date,planned_transaction_id").eq("user_id", userId).order("id").range(from, to))),
        allRows((from, to) => page(supabase.from("transaction_tags").select("transaction_id,tag_id,transactions!inner(user_id)").eq("transactions.user_id", userId).order("transaction_id").order("tag_id").range(from, to))),
        allRows((from, to) => page(supabase.from("recurring_transactions").select("id,user_id,type,amount,currency,account_id,category_id,memo,frequency,interval_count,day_of_month,start_date,end_date,next_run_date,confirmation_mode,is_active").eq("user_id", userId).order("id").range(from, to))),
        allRows((from, to) => page(supabase.from("planned_transactions").select("id,user_id,type,status,scheduled_date,amount,currency,base_amount,base_currency,exchange_rate,account_id,category_id,memo,converted_transaction_id").eq("user_id", userId).order("id").range(from, to))),
        allRows((from, to) => page(supabase.from("installment_plans").select("id,user_id,transaction_id,total_amount,installment_count,interest_type,start_month").eq("user_id", userId).order("id").range(from, to))),
        allRows((from, to) => page(supabase.from("installment_payments").select("id,user_id,installment_plan_id,sequence,scheduled_date,principal_amount,fee_amount,status,settlement_transfer_id").eq("user_id", userId).order("id").range(from, to))),
        allRows((from, to) => page(supabase.from("monthly_budgets").select("id,user_id,year,month,total_budget").eq("user_id", userId).order("id").range(from, to))),
        allRows((from, to) => page(supabase.from("category_budgets").select("id,user_id,year,month,category_id,base_budget,rollover_enabled,rollover_amount").eq("user_id", userId).order("id").range(from, to))),
        allRows((from, to) => page(supabase.from("savings_goals").select("id,user_id,name,target_amount,target_date,monthly_contribution_plan,is_active").eq("user_id", userId).order("id").range(from, to))),
        allRows((from, to) => page(supabase.from("savings_contributions").select("id,user_id,goal_id,amount,contribution_date,transaction_id,transfer_id").eq("user_id", userId).order("id").range(from, to))),
      ]);

      const profile = result(profileResult) as BackupReadData["profile"];
      const transactionTags = transactionTagsResult as Array<{ transaction_id: string; tag_id: string }>;
      return {
        profile,
        accounts: numericRows(accountsResult, ["initial_balance", "sort_order"]) as BackupReadData["accounts"],
        credit_card_settings: numericRows(cardSettingsResult, ["payment_day", "credit_limit", "billing_cycle_start_offset", "billing_cycle_end_offset"]) as BackupReadData["credit_card_settings"],
        categories: numericRows(categoriesResult, ["sort_order"]) as BackupReadData["categories"],
        tags: tagsResult as BackupReadData["tags"],
        transactions: numericRows(transactionsResult, ["amount", "base_amount"]) as BackupReadData["transactions"],
        transaction_tags: transactionTags.map(({ transaction_id, tag_id }) => ({ transaction_id, tag_id })),
        recurring_transactions: numericRows(recurringResult, ["amount", "interval_count", "day_of_month"]) as BackupReadData["recurring_transactions"],
        planned_transactions: numericRows(plannedResult, ["amount", "base_amount"]) as BackupReadData["planned_transactions"],
        installment_plans: numericRows(plansResult, ["total_amount", "installment_count"]) as BackupReadData["installment_plans"],
        installment_payments: numericRows(paymentsResult, ["sequence", "principal_amount", "fee_amount"]) as BackupReadData["installment_payments"],
        monthly_budgets: numericRows(monthlyBudgetsResult, ["year", "month", "total_budget"]) as BackupReadData["monthly_budgets"],
        category_budgets: numericRows(categoryBudgetsResult, ["year", "month", "base_budget", "rollover_amount"]) as BackupReadData["category_budgets"],
        savings_goals: numericRows(savingsGoalsResult, ["target_amount", "monthly_contribution_plan"]) as BackupReadData["savings_goals"],
        savings_contributions: numericRows(savingsContributionsResult, ["amount"]) as BackupReadData["savings_contributions"],
      };
    },
    async restoreBackup(userId, payload): Promise<void> {
      const { error } = await supabase.rpc("restore_backup", { target_user_id: userId, input_backup: payload });
      if (error) throw new Error(error.message);
    },
  };
}
