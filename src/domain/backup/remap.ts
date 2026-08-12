import type { BackupPayload } from "./schema";
import { parseBackup } from "./validate";

export type BackupIdMaps = Record<
  "accounts" | "credit_card_settings" | "categories" | "tags" | "transactions" | "recurring_transactions" | "planned_transactions" | "installment_plans" | "installment_payments" | "monthly_budgets" | "category_budgets" | "savings_goals" | "savings_contributions",
  ReadonlyMap<string, string>
>;
export type RemappedBackup = { payload: BackupPayload; idMaps: BackupIdMaps };
export type IdGenerator = () => string;

const ID_COLLECTIONS = ["accounts", "credit_card_settings", "categories", "tags", "transactions", "recurring_transactions", "planned_transactions", "installment_plans", "installment_payments", "monthly_budgets", "category_budgets", "savings_goals", "savings_contributions"] as const;

function fail(path: string, id: string): never { throw new RangeError(`${path} references ${id} outside the backup graph`); }
function mapped(map: ReadonlyMap<string, string>, id: string | null, path: string): string | null { if (id === null) return null; const value = map.get(id); if (value === undefined) fail(path, id); return value; }
function freshMaps(payload: BackupPayload, generateId: IdGenerator): BackupIdMaps {
  const maps = {} as { [Collection in keyof BackupIdMaps]: Map<string, string> };
  const outputIds = new Set<string>();
  for (const name of ID_COLLECTIONS) {
    maps[name] = new Map<string, string>();
    for (const row of payload[name]) {
      const id = generateId();
      if (!id || outputIds.has(id)) throw new RangeError("id generator must return unique non-empty ids");
      outputIds.add(id);
      maps[name].set(row.id, id);
    }
  }
  return maps;
}

export function remapBackup(input: unknown, currentUserId: string, generateId: IdGenerator = () => crypto.randomUUID()): RemappedBackup {
  if (!currentUserId.trim()) throw new TypeError("currentUserId must be a non-empty string");
  const source = parseBackup(input);
  const idMaps = freshMaps(source, generateId);
  const mapId = (collection: keyof BackupIdMaps, id: string | null, path: string) => mapped(idMaps[collection], id, path);
  const payload: BackupPayload = {
    ...source,
    profile: { ...source.profile, id: currentUserId },
    accounts: source.accounts.map((row) => ({ ...row, id: mapId("accounts", row.id, "accounts.id")!, user_id: currentUserId, linked_account_id: mapId("accounts", row.linked_account_id, "accounts.linked_account_id") })),
    credit_card_settings: source.credit_card_settings.map((row) => ({ ...row, id: mapId("credit_card_settings", row.id, "credit_card_settings.id")!, user_id: currentUserId, account_id: mapId("accounts", row.account_id, "credit_card_settings.account_id")!, payment_account_id: mapId("accounts", row.payment_account_id, "credit_card_settings.payment_account_id")! })),
    categories: source.categories.map((row) => ({ ...row, id: mapId("categories", row.id, "categories.id")!, user_id: currentUserId })),
    tags: source.tags.map((row) => ({ ...row, id: mapId("tags", row.id, "tags.id")!, user_id: currentUserId })),
    transactions: source.transactions.map((row) => ({ ...row, id: mapId("transactions", row.id, "transactions.id")!, user_id: currentUserId, category_id: mapId("categories", row.category_id, "transactions.category_id"), account_id: mapId("accounts", row.account_id, "transactions.account_id"), from_account_id: mapId("accounts", row.from_account_id, "transactions.from_account_id"), to_account_id: mapId("accounts", row.to_account_id, "transactions.to_account_id"), recurring_rule_id: mapId("recurring_transactions", row.recurring_rule_id, "transactions.recurring_rule_id"), planned_transaction_id: mapId("planned_transactions", row.planned_transaction_id, "transactions.planned_transaction_id") })),
    transaction_tags: source.transaction_tags.map((row) => ({ transaction_id: mapId("transactions", row.transaction_id, "transaction_tags.transaction_id")!, tag_id: mapId("tags", row.tag_id, "transaction_tags.tag_id")! })),
    recurring_transactions: source.recurring_transactions.map((row) => ({ ...row, id: mapId("recurring_transactions", row.id, "recurring_transactions.id")!, user_id: currentUserId, account_id: mapId("accounts", row.account_id, "recurring_transactions.account_id")!, category_id: mapId("categories", row.category_id, "recurring_transactions.category_id") })),
    planned_transactions: source.planned_transactions.map((row) => ({ ...row, id: mapId("planned_transactions", row.id, "planned_transactions.id")!, user_id: currentUserId, account_id: mapId("accounts", row.account_id, "planned_transactions.account_id"), category_id: mapId("categories", row.category_id, "planned_transactions.category_id"), converted_transaction_id: mapId("transactions", row.converted_transaction_id, "planned_transactions.converted_transaction_id") })),
    installment_plans: source.installment_plans.map((row) => ({ ...row, id: mapId("installment_plans", row.id, "installment_plans.id")!, user_id: currentUserId, transaction_id: mapId("transactions", row.transaction_id, "installment_plans.transaction_id")! })),
    installment_payments: source.installment_payments.map((row) => ({ ...row, id: mapId("installment_payments", row.id, "installment_payments.id")!, user_id: currentUserId, installment_plan_id: mapId("installment_plans", row.installment_plan_id, "installment_payments.installment_plan_id")!, settlement_transfer_id: mapId("transactions", row.settlement_transfer_id, "installment_payments.settlement_transfer_id") })),
    monthly_budgets: source.monthly_budgets.map((row) => ({ ...row, id: mapId("monthly_budgets", row.id, "monthly_budgets.id")!, user_id: currentUserId })),
    category_budgets: source.category_budgets.map((row) => ({ ...row, id: mapId("category_budgets", row.id, "category_budgets.id")!, user_id: currentUserId, category_id: mapId("categories", row.category_id, "category_budgets.category_id")! })),
    savings_goals: source.savings_goals.map((row) => ({ ...row, id: mapId("savings_goals", row.id, "savings_goals.id")!, user_id: currentUserId })),
    savings_contributions: source.savings_contributions.map((row) => ({ ...row, id: mapId("savings_contributions", row.id, "savings_contributions.id")!, user_id: currentUserId, goal_id: mapId("savings_goals", row.goal_id, "savings_contributions.goal_id")!, transaction_id: mapId("transactions", row.transaction_id, "savings_contributions.transaction_id"), transfer_id: mapId("transactions", row.transfer_id, "savings_contributions.transfer_id") })),
  };
  return { payload, idMaps };
}
