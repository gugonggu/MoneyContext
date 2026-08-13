import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { addIsoDays, seoulDayStartUtcIso, toSeoulDate } from "@/lib/dates/seoul";
import type { CalendarRepository, CalendarSourceData } from "@/server/calendar/service";

type NamedRow = Readonly<{ name: string }> | readonly Readonly<{ name: string }>[] | null;

function firstName(value: NamedRow): string | undefined {
  if (!value) return undefined;
  const row = Array.isArray(value) ? value[0] : value;
  return row?.name;
}

function toSafeInteger(value: unknown, field: string): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount)) throw new Error(`${field} must be a safe integer`);
  return amount;
}

export function createCalendarRepository(supabase: SupabaseClient): CalendarRepository {
  return {
    async getSourceData(userId, range): Promise<CalendarSourceData> {
      const fromInstant = seoulDayStartUtcIso(range.start);
      const toInstant = seoulDayStartUtcIso(addIsoDays(range.end, 1));

      const [transactions, planned, cards, recurring] = await Promise.all([
        supabase
          .from("transactions")
          .select(
            "id,type,status,transaction_at,base_amount,memo,recurring_rule_id,categories(name),accounts!transactions_account_id_fkey(name)",
          )
          .eq("user_id", userId)
          .eq("status", "CONFIRMED")
          .in("type", ["INCOME", "EXPENSE"])
          .gte("transaction_at", fromInstant)
          .lt("transaction_at", toInstant)
          .order("transaction_at"),
        supabase
          .from("planned_transactions")
          .select("scheduled_date,type,amount,base_amount,memo")
          .eq("user_id", userId)
          .eq("status", "PLANNED")
          .gte("scheduled_date", range.start)
          .lte("scheduled_date", range.end),
        supabase
          .from("credit_card_settings")
          .select("account_id,payment_day,first_payment_date,accounts!credit_card_settings_account_id_fkey(name)")
          .eq("user_id", userId),
        supabase
          .from("recurring_transactions")
          .select("id,memo,type,amount,frequency,interval_count,day_of_month,next_run_date,end_date")
          .eq("user_id", userId)
          .eq("is_active", true),
      ]);

      for (const result of [transactions, planned, cards, recurring]) {
        if (result.error) throw new Error(result.error.message);
      }

      const transactionRows = (transactions.data ?? []) as readonly Record<string, unknown>[];

      return {
        transactions: transactionRows.map((row) => ({
          id: String(row.id),
          type: row.type as "INCOME" | "EXPENSE",
          status: "CONFIRMED" as const,
          transactionAt: String(row.transaction_at),
          baseAmount: toSafeInteger(row.base_amount, "transaction base_amount"),
          ...(row.memo ? { memo: String(row.memo) } : {}),
          ...(firstName(row.categories as NamedRow) ? { categoryName: firstName(row.categories as NamedRow) } : {}),
          ...(firstName(row.accounts as NamedRow) ? { accountName: firstName(row.accounts as NamedRow) } : {}),
        })),
        planned: ((planned.data ?? []) as readonly Record<string, unknown>[]).map((row) => ({
          scheduledDate: String(row.scheduled_date),
          type: row.type as "INCOME" | "EXPENSE",
          amount: toSafeInteger(row.amount, "planned transaction amount"),
          ...(row.base_amount === null || row.base_amount === undefined
            ? {}
            : { baseAmount: toSafeInteger(row.base_amount, "planned transaction base_amount") }),
          ...(row.memo ? { memo: String(row.memo) } : {}),
        })),
        cards: ((cards.data ?? []) as readonly Record<string, unknown>[]).map((row) => ({
          accountId: String(row.account_id),
          accountName: firstName(row.accounts as NamedRow) ?? "카드",
          paymentDay: Number(row.payment_day),
          ...(row.first_payment_date ? { firstPaymentDate: String(row.first_payment_date) } : {}),
        })),
        recurringRules: ((recurring.data ?? []) as readonly Record<string, unknown>[]).map((row) => ({
          id: String(row.id),
          ...(row.memo ? { memo: String(row.memo) } : {}),
          type: row.type as "INCOME" | "EXPENSE",
          amount: toSafeInteger(row.amount, "recurring transaction amount"),
          frequency: row.frequency as "DAILY" | "WEEKLY" | "MONTHLY",
          intervalCount: Number(row.interval_count),
          ...(row.day_of_month === null || row.day_of_month === undefined
            ? {}
            : { dayOfMonth: Number(row.day_of_month) }),
          nextRunDate: String(row.next_run_date),
          ...(row.end_date ? { endDate: String(row.end_date) } : {}),
        })),
        confirmedRecurringDates: transactionRows.flatMap((row) =>
          row.recurring_rule_id
            ? [{ ruleId: String(row.recurring_rule_id), date: toSeoulDate(String(row.transaction_at)) }]
            : [],
        ),
      };
    },
  };
}
