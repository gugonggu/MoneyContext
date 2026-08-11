import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  GeneratedOccurrence,
  RecurringRepository,
  RecurringRule,
  ValidRecurringInput,
} from "@/server/recurring/service";

const map = (row: Record<string, unknown>): RecurringRule => ({
  id: String(row.id),
  userId: String(row.user_id),
  type: row.type as RecurringRule["type"],
  amount: Number(row.amount),
  currency: String(row.currency),
  accountId: String(row.account_id),
  categoryId: row.category_id ? String(row.category_id) : undefined,
  memo: row.memo ? String(row.memo) : undefined,
  frequency: row.frequency as RecurringRule["frequency"],
  intervalCount: Number(row.interval_count),
  dayOfMonth: row.day_of_month === null ? undefined : Number(row.day_of_month),
  startDate: String(row.start_date),
  endDate: row.end_date ? String(row.end_date) : undefined,
  nextRunDate: String(row.next_run_date),
  confirmationMode: row.confirmation_mode as RecurringRule["confirmationMode"],
  isActive: Boolean(row.is_active),
});

const payload = (input: ValidRecurringInput) => ({
  type: input.type,
  amount: input.amount,
  currency: input.currency,
  account_id: input.accountId,
  category_id: input.categoryId ?? null,
  memo: input.memo ?? null,
  frequency: input.frequency,
  interval_count: input.intervalCount,
  day_of_month: input.dayOfMonth ?? null,
  start_date: input.startDate,
  end_date: input.endDate ?? null,
  next_run_date: input.nextRunDate,
  confirmation_mode: input.confirmationMode,
});

export function createRecurringRepository(supabase: SupabaseClient): RecurringRepository {
  return {
    async findAccount(userId, id) {
      const { data, error } = await supabase.from("accounts").select("id,user_id,is_active").eq("user_id", userId).eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { id: data.id, userId: data.user_id, isActive: data.is_active } : null;
    },
    async findCategory(userId, id) {
      const { data, error } = await supabase.from("categories").select("id,user_id,is_active").eq("user_id", userId).eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { id: data.id, userId: data.user_id, isActive: data.is_active } : null;
    },
    async createRule(userId, input) {
      const { data, error } = await supabase.from("recurring_transactions").insert({ user_id: userId, ...payload(input) }).select("*").single();
      if (error) throw new Error(error.message);
      return map(data);
    },
    async listRules(userId) {
      const { data, error } = await supabase.from("recurring_transactions").select("*").eq("user_id", userId).order("next_run_date");
      if (error) throw new Error(error.message);
      return data.map(map);
    },
    async updateRule(userId, id, input) {
      const { data, error } = await supabase.from("recurring_transactions").update(payload(input)).eq("user_id", userId).eq("id", id).select("*").maybeSingle();
      if (error) throw new Error(error.message);
      return data ? map(data) : null;
    },
    async deactivateRule(userId, id) {
      const { data, error } = await supabase.from("recurring_transactions").update({ is_active: false }).eq("user_id", userId).eq("id", id).select("id").maybeSingle();
      if (error) throw new Error(error.message);
      return data !== null;
    },
    async generateDue(_userId, today) {
      const { data, error } = await supabase.rpc("generate_due_recurring_transactions", {
        input_today: today,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row: Record<string, unknown>): GeneratedOccurrence => ({
        ruleId: String(row.rule_id),
        occurrenceDate: String(row.occurrence_date),
        status: row.transaction_status as GeneratedOccurrence["status"],
      }));
    },
  };
}
