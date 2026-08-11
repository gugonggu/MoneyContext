import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  PlannedRepository,
  PlannedTransactionRecord,
  ValidPlannedTransactionInput,
} from "@/server/planned/service";

const map = (row: Record<string, unknown>): PlannedTransactionRecord => ({
  id: String(row.id),
  userId: String(row.user_id),
  type: row.type as PlannedTransactionRecord["type"],
  status: row.status as PlannedTransactionRecord["status"],
  scheduledDate: String(row.scheduled_date),
  amount: Number(row.amount),
  currency: String(row.currency),
  baseAmount: row.base_amount === null || row.base_amount === undefined ? undefined : Number(row.base_amount),
  exchangeRate: row.exchange_rate === null || row.exchange_rate === undefined ? undefined : String(row.exchange_rate),
  accountId: row.account_id ? String(row.account_id) : undefined,
  categoryId: row.category_id ? String(row.category_id) : undefined,
  memo: row.memo ? String(row.memo) : undefined,
  convertedTransactionId: row.converted_transaction_id ? String(row.converted_transaction_id) : undefined,
});

const payload = (input: ValidPlannedTransactionInput) => ({
  type: input.type,
  scheduled_date: input.scheduledDate,
  amount: input.amount,
  currency: input.currency,
  base_amount: input.baseAmount ?? null,
  base_currency: "KRW",
  exchange_rate: input.exchangeRate ?? null,
  account_id: input.accountId ?? null,
  category_id: input.categoryId ?? null,
  memo: input.memo ?? null,
});

export function createPlannedRepository(supabase: SupabaseClient): PlannedRepository {
  return {
    async findAccount(userId, id) {
      const { data, error } = await supabase
        .from("accounts")
        .select("id,user_id,is_active")
        .eq("user_id", userId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { id: data.id, userId: data.user_id, isActive: data.is_active } : null;
    },
    async findCategory(userId, id) {
      const { data, error } = await supabase
        .from("categories")
        .select("id,user_id,is_active")
        .eq("user_id", userId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { id: data.id, userId: data.user_id, isActive: data.is_active } : null;
    },
    async find(userId, id) {
      const { data, error } = await supabase
        .from("planned_transactions")
        .select("*")
        .eq("user_id", userId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? map(data) : null;
    },
    async create(userId, input) {
      const { data, error } = await supabase
        .from("planned_transactions")
        .insert({ user_id: userId, ...payload(input) })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return map(data);
    },
    async list(userId) {
      const { data, error } = await supabase
        .from("planned_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("scheduled_date");
      if (error) throw new Error(error.message);
      return data.map(map);
    },
    async update(userId, id, input) {
      const { data, error } = await supabase
        .from("planned_transactions")
        .update(payload(input))
        .eq("user_id", userId)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? map(data) : null;
    },
    async remove(userId, id) {
      const { data, error } = await supabase
        .from("planned_transactions")
        .delete()
        .eq("user_id", userId)
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data !== null;
    },
    async confirm(userId, id) {
      const { error } = await supabase.rpc("confirm_planned_transaction", { input_planned_id: id });
      if (error) return null;
      const { data } = await supabase.from("planned_transactions").select("*").eq("user_id", userId).eq("id", id).maybeSingle();
      return data ? map(data) : null;
    },
  };
}
