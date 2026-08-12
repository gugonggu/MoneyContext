import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { GeneratedOccurrence } from "@/server/recurring/service";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

function assertValidIsoDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError("today must be a valid ISO date (YYYY-MM-DD)");
}

async function generateDueRecurringTransactionsForAllUsers(supabase: SupabaseClient, today: string): Promise<GeneratedOccurrence[]> {
  assertValidIsoDate(today);
  const { data, error } = await supabase.rpc("generate_due_recurring_transactions_for_all_users", { input_today: today });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: Record<string, unknown>): GeneratedOccurrence => ({
    ruleId: String(row.rule_id),
    occurrenceDate: String(row.occurrence_date),
    status: row.transaction_status as GeneratedOccurrence["status"],
  }));
}

export function runRecurringTransactionCron(today: string): Promise<GeneratedOccurrence[]> {
  return generateDueRecurringTransactionsForAllUsers(createSupabaseAdminClient(), today);
}
