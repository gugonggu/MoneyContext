import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AccountRecord, AccountRepository, CreditCardSettingsRecord } from "@/server/accounts/service";

type AccountRow = {
  id: string;
  user_id: string;
  name: string;
  type: AccountRecord["type"];
  initial_balance: number | string;
  linked_account_id: string | null;
  is_active: boolean;
  sort_order: number;
};

function toAccountRecord(row: AccountRow): AccountRecord {
  const initialBalance = Number(row.initial_balance);
  if (!Number.isSafeInteger(initialBalance)) throw new Error("account initial_balance must be a safe integer");
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type,
    initialBalance,
    linkedAccountId: row.linked_account_id,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

export function createAccountRepository(supabase: SupabaseClient): AccountRepository {
  return {
    async list(userId, activeOnly) {
      let query = supabase.from("accounts").select("*").eq("user_id", userId).order("sort_order").order("created_at");
      if (activeOnly) query = query.eq("is_active", true);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data as AccountRow[]).map(toAccountRecord);
    },

    async findById(userId, accountId) {
      const { data, error } = await supabase.from("accounts").select("*").eq("user_id", userId).eq("id", accountId).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toAccountRecord(data as AccountRow) : null;
    },

    async create(userId, input) {
      const { data, error } = await supabase.from("accounts").insert({
        user_id: userId,
        name: input.name,
        type: input.type,
        initial_balance: input.initialBalance,
        linked_account_id: input.linkedAccountId,
        sort_order: input.sortOrder,
      }).select("*").single();
      if (error) throw new Error(error.message);
      return toAccountRecord(data as AccountRow);
    },

    async update(userId, accountId, input) {
      const update = {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.initialBalance === undefined ? {} : { initial_balance: input.initialBalance }),
        ...(input.linkedAccountId === undefined ? {} : { linked_account_id: input.linkedAccountId }),
        ...(input.sortOrder === undefined ? {} : { sort_order: input.sortOrder }),
      };
      const { data, error } = await supabase.from("accounts").update(update).eq("user_id", userId).eq("id", accountId).select("*").maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toAccountRecord(data as AccountRow) : null;
    },

    async deactivate(userId, accountId) {
      const { data, error } = await supabase.from("accounts").update({ is_active: false }).eq("user_id", userId).eq("id", accountId).select("id").maybeSingle();
      if (error) throw new Error(error.message);
      return data !== null;
    },

    async createCreditCardSettings(userId, input): Promise<CreditCardSettingsRecord> {
      const { data, error } = await supabase.from("credit_card_settings").insert({
        user_id: userId,
        account_id: input.accountId,
        payment_account_id: input.paymentAccountId,
        payment_day: input.paymentDay,
        credit_limit: input.creditLimit,
        billing_cycle_rule: {},
      }).select("id, user_id, account_id, payment_account_id, payment_day, credit_limit").single();
      if (error) throw new Error(error.message);
      return {
        id: data.id,
        userId: data.user_id,
        accountId: data.account_id,
        paymentAccountId: data.payment_account_id,
        paymentDay: data.payment_day,
        creditLimit: data.credit_limit === null ? null : Number(data.credit_limit),
      };
    },
  };
}
