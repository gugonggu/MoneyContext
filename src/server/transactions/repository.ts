import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TransactionRecord, TransactionRepository } from "@/server/transactions/service";

const map = (row: Record<string, unknown>): TransactionRecord => ({ id: String(row.id), userId: String(row.user_id), type: row.type as TransactionRecord["type"], amount: Number(row.amount), baseAmount: Number(row.base_amount), currency: String(row.currency), transactionAt: String(row.transaction_at), accountId: row.account_id as string | undefined, fromAccountId: row.from_account_id as string | undefined, toAccountId: row.to_account_id as string | undefined, categoryId: row.category_id as string | undefined, exchangeRate: row.exchange_rate as string | undefined, memo: row.memo as string | undefined });
const payload = (input: Omit<TransactionRecord, "id" | "userId">) => ({ type: input.type, amount: input.amount, base_amount: input.baseAmount, currency: input.currency, transaction_at: input.transactionAt, account_id: input.accountId ?? null, from_account_id: input.fromAccountId ?? null, to_account_id: input.toAccountId ?? null, category_id: input.categoryId ?? null, exchange_rate: input.exchangeRate ?? null, memo: input.memo ?? null });
export function createTransactionRepository(supabase: SupabaseClient): TransactionRepository { return {
  async findAccount(userId, id) { const { data, error } = await supabase.from("accounts").select("id,user_id,type,is_active").eq("user_id", userId).eq("id", id).maybeSingle(); if (error) throw new Error(error.message); return data ? { id: data.id, userId: data.user_id, type: data.type, isActive: data.is_active } : null; },
  async findCategory(userId, id) { const { data, error } = await supabase.from("categories").select("id,user_id,is_active").eq("user_id", userId).eq("id", id).maybeSingle(); if (error) throw new Error(error.message); return data ? { id: data.id, userId: data.user_id, isActive: data.is_active } : null; },
  async create(userId, input) { const { data, error } = await supabase.from("transactions").insert({ user_id: userId, status: "CONFIRMED", ...payload(input) }).select("*").single(); if (error) throw new Error(error.message); return map(data); },
  async list(userId) { const { data, error } = await supabase.from("transactions").select("*").eq("user_id", userId).order("transaction_at", { ascending: false }); if (error) throw new Error(error.message); return data.map(map); },
  async update(userId, id, input) { const { data, error } = await supabase.from("transactions").update(payload(input)).eq("user_id", userId).eq("id", id).select("*").maybeSingle(); if (error) throw new Error(error.message); return data ? map(data) : null; },
  async remove(userId, id) { const { data, error } = await supabase.from("transactions").delete().eq("user_id", userId).eq("id", id).select("id").maybeSingle(); if (error) throw new Error(error.message); return data !== null; },
  async listRecentForPatterns(userId, limit) {
    const { data, error } = await supabase
      .from("transactions")
      .select("account_id,category_id,type,transaction_at")
      .eq("user_id", userId)
      .eq("status", "CONFIRMED")
      .in("type", ["INCOME", "EXPENSE"])
      .order("transaction_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data.map((row) => ({
      accountId: String(row.account_id),
      categoryId: row.category_id ? String(row.category_id) : undefined,
      type: row.type as "INCOME" | "EXPENSE",
      transactionAt: String(row.transaction_at),
    }));
  },
}; }
