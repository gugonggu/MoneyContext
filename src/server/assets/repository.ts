import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AssetAccountRecord,
  AssetCardSettingsRecord,
  AssetInstallmentPaymentRecord,
  AssetReadRepository,
  AssetTransactionRecord,
} from "@/server/assets/service";
import type { ReconciliationAccount, ReconciliationRepository } from "@/server/assets/reconciliation";

type AccountRow = Readonly<{
  id: string;
  user_id: string;
  name: string;
  type: AssetAccountRecord["type"];
  initial_balance: number | string;
  linked_account_id: string | null;
  sort_order: number;
}>;

type TransactionRow = Readonly<{
  id: string;
  user_id: string;
  type: AssetTransactionRecord["type"];
  status: AssetTransactionRecord["status"];
  base_amount: number | string;
  account_id: string | null;
  from_account_id: string | null;
  to_account_id: string | null;
}>;

type CardSettingsRow = Readonly<{
  id: string;
  user_id: string;
  account_id: string;
  payment_account_id: string;
  payment_day: number;
  credit_limit: number | string | null;
  first_payment_date: string | null;
}>;

type InstallmentPaymentRow = Readonly<{
  id: string;
  user_id: string;
  sequence: number;
  scheduled_date: string;
  principal_amount: number | string;
  fee_amount: number | string;
  status: AssetInstallmentPaymentRecord["status"];
  installment_plans: { transactions: { account_id: string | null } | null } | null;
}>;

function toSafeInteger(value: number | string, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${field} must be a safe integer`);
  return parsed;
}

function toAccountRecord(row: AccountRow): AssetAccountRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type,
    initialBalance: toSafeInteger(row.initial_balance, "account initial_balance"),
    linkedAccountId: row.linked_account_id,
    sortOrder: row.sort_order,
  };
}

function toTransactionRecord(row: TransactionRow): AssetTransactionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    status: row.status,
    amount: toSafeInteger(row.base_amount, "transaction base_amount"),
    ...(row.account_id === null ? {} : { accountId: row.account_id }),
    ...(row.from_account_id === null ? {} : { fromAccountId: row.from_account_id }),
    ...(row.to_account_id === null ? {} : { toAccountId: row.to_account_id }),
  };
}

function toCardSettingsRecord(row: CardSettingsRow): AssetCardSettingsRecord {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    paymentAccountId: row.payment_account_id,
    paymentDay: row.payment_day,
    creditLimit: row.credit_limit === null ? null : toSafeInteger(row.credit_limit, "credit card credit_limit"),
    firstPaymentDate: row.first_payment_date,
  };
}

function toInstallmentPaymentRecord(row: InstallmentPaymentRow): AssetInstallmentPaymentRecord {
  const cardAccountId = row.installment_plans?.transactions?.account_id;
  if (!cardAccountId) throw new Error("installment payment must have a card account");
  return {
    id: row.id,
    userId: row.user_id,
    cardAccountId,
    sequence: row.sequence,
    scheduledDate: row.scheduled_date,
    principalAmount: toSafeInteger(row.principal_amount, "installment principal_amount"),
    feeAmount: toSafeInteger(row.fee_amount, "installment fee_amount"),
    status: row.status,
  };
}

export function createAssetReadRepository(supabase: SupabaseClient): AssetReadRepository {
  return {
    async listAccounts(userId) {
      const { data, error } = await supabase
        .from("accounts")
        .select("id,user_id,name,type,initial_balance,linked_account_id,sort_order")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("sort_order")
        .order("created_at");
      if (error) throw new Error(error.message);
      return (data as AccountRow[]).map(toAccountRecord);
    },

    async listTransactions(userId) {
      const { data, error } = await supabase
        .from("transactions")
        .select("id,user_id,type,status,base_amount,account_id,from_account_id,to_account_id")
        .eq("user_id", userId)
        .eq("status", "CONFIRMED");
      if (error) throw new Error(error.message);
      return (data as TransactionRow[]).map(toTransactionRecord);
    },

    async listCardSettings(userId) {
      const { data, error } = await supabase
        .from("credit_card_settings")
        .select("id,user_id,account_id,payment_account_id,payment_day,credit_limit,first_payment_date")
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return (data as CardSettingsRow[]).map(toCardSettingsRecord);
    },

    async listInstallmentPayments(userId) {
      const { data, error } = await supabase
        .from("installment_payments")
        .select("id,user_id,sequence,scheduled_date,principal_amount,fee_amount,status,installment_plans!inner(transactions!inner(account_id))")
        .eq("user_id", userId)
        .order("scheduled_date")
        .order("sequence");
      if (error) throw new Error(error.message);
      return (data as unknown as InstallmentPaymentRow[]).map(toInstallmentPaymentRecord);
    },
  };
}

export function createReconciliationRepository(supabase: SupabaseClient): ReconciliationRepository {
  const readRepository = createAssetReadRepository(supabase);
  return {
    async findAccount(userId, accountId): Promise<ReconciliationAccount | null> {
      const { data, error } = await supabase.from("accounts").select("id,user_id,is_active").eq("user_id", userId).eq("id", accountId).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { id: data.id, userId: data.user_id, isActive: data.is_active } : null;
    },
    async getCalculatedBalance(userId, accountId) {
      const { createAssetReadService } = await import("@/server/assets/service");
      const overview = await createAssetReadService(readRepository).getOverview(userId);
      const account = [...overview.accounts.bank, ...overview.accounts.cash, ...overview.accounts.debit, ...overview.accounts.liability].find((item) => item.id === accountId);
      if (!account) throw new Error("account does not support balance reconciliation");
      return account.balance;
    },
  };
}
