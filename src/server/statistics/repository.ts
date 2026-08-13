import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StatisticsTransaction } from "./service";

type NamedRow = Readonly<{ name: string }> | readonly Readonly<{ name: string }>[] | null;
const firstName = (value: NamedRow): string | undefined => (Array.isArray(value) ? value[0] : value)?.name;

// A TRANSFER with only one of from/to_account_id is money sent to or received
// from outside the tracked accounts (e.g. paying a friend back) - it behaves
// like a real EXPENSE/INCOME for statistics. A TRANSFER with both sides is
// between two of the user's own accounts and stays excluded (net-worth neutral).
function effectiveType(type: string, fromAccountId: string | null, toAccountId: string | null): StatisticsTransaction["type"] {
  if (type !== "TRANSFER") return type as StatisticsTransaction["type"];
  if (fromAccountId && !toAccountId) return "EXPENSE";
  if (toAccountId && !fromAccountId) return "INCOME";
  return "TRANSFER";
}

export async function listStatisticsTransactions(supabase: SupabaseClient, userId: string): Promise<readonly StatisticsTransaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "type,status,transaction_at,base_amount,recurring_rule_id,from_account_id,to_account_id,categories(name),account:accounts!transactions_account_id_fkey(name),from_account:accounts!transactions_from_account_id_fkey(name),to_account:accounts!transactions_to_account_id_fkey(name),transaction_tags(tags(name))",
    )
    .eq("user_id", userId)
    .eq("status", "CONFIRMED")
    .in("type", ["INCOME", "EXPENSE", "TRANSFER"]);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
    const links = (row.transaction_tags ?? []) as Array<{ tags: { name: string } | { name: string }[] | null }>;
    const accountName = firstName(row.account as NamedRow) ?? firstName(row.from_account as NamedRow) ?? firstName(row.to_account as NamedRow);

    return {
      type: effectiveType(row.type, row.from_account_id, row.to_account_id),
      status: row.status as StatisticsTransaction["status"],
      transactionAt: String(row.transaction_at),
      baseAmount: Number(row.base_amount),
      categoryName: category?.name,
      accountName,
      recurringRuleId: row.recurring_rule_id ?? undefined,
      tagNames: links.flatMap((link) => (Array.isArray(link.tags) ? link.tags : link.tags ? [link.tags] : [])).map((tag) => tag.name),
    };
  });
}
