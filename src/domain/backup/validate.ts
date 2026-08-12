import {
  BACKUP_SCHEMA,
  BACKUP_SCHEMA_VERSION,
  BACKUP_TIMEZONE,
  type BackupAccount,
  type BackupCategory,
  type BackupCategoryBudget,
  type BackupCreditCardSettings,
  type BackupInstallmentPayment,
  type BackupInstallmentPlan,
  type BackupMetadata,
  type BackupPayload,
  type BackupPlannedTransaction,
  type BackupProfile,
  type BackupRecurringTransaction,
  type BackupSavingsContribution,
  type BackupSavingsGoal,
  type BackupTag,
  type BackupTransaction,
  type BackupTransactionTag,
  type BackupMonthlyBudget,
} from "./schema";

type JsonRecord = Record<string, unknown>;

function fail(path: string, message: string): never { throw new TypeError(`${path} ${message}`); }
function object(value: unknown, path: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(path, "must be an object");
  return value as JsonRecord;
}
function string(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) fail(path, "must be a non-empty string");
  return value;
}
function nullableString(value: unknown, path: string): string | null { return value === null ? null : string(value, path); }
function boolean(value: unknown, path: string): boolean { if (typeof value !== "boolean") fail(path, "must be a boolean"); return value; }
function integer(value: unknown, path: string): number { if (typeof value !== "number" || !Number.isSafeInteger(value)) fail(path, "must be a safe integer"); return value; }
function nonNegative(value: unknown, path: string): number { const result = integer(value, path); if (result < 0) fail(path, "must be non-negative"); return result; }
function positive(value: unknown, path: string): number { const result = integer(value, path); if (result <= 0) fail(path, "must be positive"); return result; }
function nullableRate(value: unknown, path: string): number | null { if (value === null) return null; if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) fail(path, "must be a positive number or null"); return value; }
function oneOf<T extends string>(value: unknown, path: string, values: readonly T[]): T { const result = string(value, path); if (!values.includes(result as T)) fail(path, "contains an invalid enum value"); return result as T; }
function currency(value: unknown, path: string): string { const result = string(value, path); if (!/^[A-Z]{3}$/.test(result)) fail(path, "must be an ISO 4217 currency"); return result; }
function isoDate(value: unknown, path: string): string {
  const result = string(value, path);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) fail(path, "must be a valid ISO date");
  const [year, month, day] = result.split("-").map(Number);
  const date = new Date(0); date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) fail(path, "must be a valid ISO date");
  return result;
}
function nullableDate(value: unknown, path: string): string | null { return value === null ? null : isoDate(value, path); }
function isoDateTime(value: unknown, path: string): string {
  const result = string(value, path);
  if (!/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(result) || Number.isNaN(Date.parse(result))) fail(path, "must be a valid ISO date-time");
  return result;
}
function array(value: unknown, path: string): unknown[] { if (!Array.isArray(value)) fail(path, "must be an array"); return value; }
function record(value: unknown, path: string): Record<string, unknown> { return object(value, path); }
function property(row: JsonRecord, key: string, path: string): unknown { return row[key] === undefined ? fail(`${path}.${key}`, "is required") : row[key]; }
function nullableInteger(value: unknown, path: string): number | null { return value === null ? null : integer(value, path); }
function nullableNonNegative(value: unknown, path: string): number | null { return value === null ? null : nonNegative(value, path); }

function rows<T>(value: unknown, path: string, parse: (row: JsonRecord, rowPath: string) => T): T[] {
  return array(value, path).map((item, index) => parse(object(item, `${path}[${index}]`), `${path}[${index}]`));
}
function owned(row: JsonRecord, path: string): { id: string; user_id: string } { return { id: string(property(row, "id", path), `${path}.id`), user_id: string(property(row, "user_id", path), `${path}.user_id`) }; }
function validateUniqueIds<T extends { id: string }>(rows: readonly T[], path: string): void { const ids = new Set<string>(); for (const row of rows) { if (ids.has(row.id)) fail(path, `contains duplicate id ${row.id}`); ids.add(row.id); } }

function parseMetadata(row: JsonRecord): BackupMetadata {
  if (property(row, "schema", "metadata") !== BACKUP_SCHEMA) fail("metadata.schema", `must be ${BACKUP_SCHEMA}`);
  if (property(row, "schema_version", "metadata") !== BACKUP_SCHEMA_VERSION) fail("metadata.schema_version", "must be 1");
  if (property(row, "timezone", "metadata") !== BACKUP_TIMEZONE) fail("metadata.timezone", "must be Asia/Seoul");
  return { schema: BACKUP_SCHEMA, schema_version: BACKUP_SCHEMA_VERSION, exported_at: isoDateTime(property(row, "exported_at", "metadata"), "metadata.exported_at"), base_currency: currency(property(row, "base_currency", "metadata"), "metadata.base_currency"), timezone: BACKUP_TIMEZONE };
}
function parseProfile(row: JsonRecord, path: string): BackupProfile { return { id: string(property(row, "id", path), `${path}.id`), display_name: string(property(row, "display_name", path), `${path}.display_name`), role: oneOf(property(row, "role", path), `${path}.role`, ["USER", "ADMIN"]), base_currency: currency(property(row, "base_currency", path), `${path}.base_currency`), salary_cycle_day: between(integer(property(row, "salary_cycle_day", path), `${path}.salary_cycle_day`), `${path}.salary_cycle_day`, 1, 31), timezone: string(property(row, "timezone", path), `${path}.timezone`), onboarding_completed: boolean(property(row, "onboarding_completed", path), `${path}.onboarding_completed`) }; }
function between(value: number, path: string, min: number, max: number): number { if (value < min || value > max) fail(path, `must be between ${min} and ${max}`); return value; }

function parseAccount(row: JsonRecord, path: string): BackupAccount { return { ...owned(row, path), name: string(property(row, "name", path), `${path}.name`), type: oneOf(property(row, "type", path), `${path}.type`, ["BANK", "CASH", "DEBIT", "CREDIT_CARD", "LIABILITY"]), initial_balance: nonNegative(property(row, "initial_balance", path), `${path}.initial_balance`), linked_account_id: nullableString(property(row, "linked_account_id", path), `${path}.linked_account_id`), is_active: boolean(property(row, "is_active", path), `${path}.is_active`), sort_order: integer(property(row, "sort_order", path), `${path}.sort_order`) }; }
function parseCard(row: JsonRecord, path: string): BackupCreditCardSettings { return { ...owned(row, path), account_id: string(property(row, "account_id", path), `${path}.account_id`), payment_day: between(integer(property(row, "payment_day", path), `${path}.payment_day`), `${path}.payment_day`, 1, 31), payment_account_id: string(property(row, "payment_account_id", path), `${path}.payment_account_id`), credit_limit: nullableNonNegative(property(row, "credit_limit", path), `${path}.credit_limit`), billing_cycle_start_offset: nullableInteger(property(row, "billing_cycle_start_offset", path), `${path}.billing_cycle_start_offset`), billing_cycle_end_offset: nullableInteger(property(row, "billing_cycle_end_offset", path), `${path}.billing_cycle_end_offset`), billing_cycle_rule: record(property(row, "billing_cycle_rule", path), `${path}.billing_cycle_rule`) }; }
function parseCategory(row: JsonRecord, path: string): BackupCategory { return { ...owned(row, path), name: string(property(row, "name", path), `${path}.name`), kind: oneOf(property(row, "kind", path), `${path}.kind`, ["INCOME", "EXPENSE", "BOTH"]), is_system_default: boolean(property(row, "is_system_default", path), `${path}.is_system_default`), is_active: boolean(property(row, "is_active", path), `${path}.is_active`), sort_order: integer(property(row, "sort_order", path), `${path}.sort_order`) }; }
function parseTag(row: JsonRecord, path: string): BackupTag { return { ...owned(row, path), name: string(property(row, "name", path), `${path}.name`), is_active: boolean(property(row, "is_active", path), `${path}.is_active`) }; }
function parseTransaction(row: JsonRecord, path: string): BackupTransaction { const type = oneOf(property(row, "type", path), `${path}.type`, ["INCOME", "EXPENSE", "TRANSFER", "ADJUSTMENT"]); const amount = type === "ADJUSTMENT" ? integer(property(row, "amount", path), `${path}.amount`) : nonNegative(property(row, "amount", path), `${path}.amount`); const baseAmount = type === "ADJUSTMENT" ? integer(property(row, "base_amount", path), `${path}.base_amount`) : nonNegative(property(row, "base_amount", path), `${path}.base_amount`); return { ...owned(row, path), type, status: oneOf(property(row, "status", path), `${path}.status`, ["PENDING", "CONFIRMED", "CANCELLED"]), transaction_at: isoDateTime(property(row, "transaction_at", path), `${path}.transaction_at`), amount, currency: currency(property(row, "currency", path), `${path}.currency`), base_amount: baseAmount, base_currency: currency(property(row, "base_currency", path), `${path}.base_currency`), exchange_rate: nullableRate(property(row, "exchange_rate", path), `${path}.exchange_rate`), category_id: nullableString(property(row, "category_id", path), `${path}.category_id`), account_id: nullableString(property(row, "account_id", path), `${path}.account_id`), from_account_id: nullableString(property(row, "from_account_id", path), `${path}.from_account_id`), to_account_id: nullableString(property(row, "to_account_id", path), `${path}.to_account_id`), memo: nullableString(property(row, "memo", path), `${path}.memo`), recurring_rule_id: nullableString(property(row, "recurring_rule_id", path), `${path}.recurring_rule_id`), recurring_occurrence_date: nullableDate(property(row, "recurring_occurrence_date", path), `${path}.recurring_occurrence_date`), planned_transaction_id: nullableString(property(row, "planned_transaction_id", path), `${path}.planned_transaction_id`) }; }
function parseTransactionTag(row: JsonRecord, path: string): BackupTransactionTag { return { transaction_id: string(property(row, "transaction_id", path), `${path}.transaction_id`), tag_id: string(property(row, "tag_id", path), `${path}.tag_id`) }; }
function parseRecurring(row: JsonRecord, path: string): BackupRecurringTransaction { const start = isoDate(property(row, "start_date", path), `${path}.start_date`); const end = nullableDate(property(row, "end_date", path), `${path}.end_date`); if (end !== null && end < start) fail(`${path}.end_date`, "must not precede start_date"); return { ...owned(row, path), type: oneOf(property(row, "type", path), `${path}.type`, ["INCOME", "EXPENSE"]), amount: nonNegative(property(row, "amount", path), `${path}.amount`), currency: currency(property(row, "currency", path), `${path}.currency`), account_id: string(property(row, "account_id", path), `${path}.account_id`), category_id: nullableString(property(row, "category_id", path), `${path}.category_id`), memo: nullableString(property(row, "memo", path), `${path}.memo`), frequency: string(property(row, "frequency", path), `${path}.frequency`), interval_count: positive(property(row, "interval_count", path), `${path}.interval_count`), day_of_month: property(row, "day_of_month", path) === null ? null : between(integer(property(row, "day_of_month", path), `${path}.day_of_month`), `${path}.day_of_month`, 1, 31), start_date: start, end_date: end, next_run_date: isoDate(property(row, "next_run_date", path), `${path}.next_run_date`), confirmation_mode: oneOf(property(row, "confirmation_mode", path), `${path}.confirmation_mode`, ["AUTO_CONFIRM", "REQUIRE_CONFIRMATION"]), is_active: boolean(property(row, "is_active", path), `${path}.is_active`) }; }
function parsePlanned(row: JsonRecord, path: string): BackupPlannedTransaction { return { ...owned(row, path), type: oneOf(property(row, "type", path), `${path}.type`, ["INCOME", "EXPENSE"]), status: oneOf(property(row, "status", path), `${path}.status`, ["PLANNED", "CONFIRMED", "CANCELLED"]), scheduled_date: isoDate(property(row, "scheduled_date", path), `${path}.scheduled_date`), amount: nonNegative(property(row, "amount", path), `${path}.amount`), currency: currency(property(row, "currency", path), `${path}.currency`), base_amount: nullableNonNegative(property(row, "base_amount", path), `${path}.base_amount`), base_currency: currency(property(row, "base_currency", path), `${path}.base_currency`), exchange_rate: nullableRate(property(row, "exchange_rate", path), `${path}.exchange_rate`), account_id: nullableString(property(row, "account_id", path), `${path}.account_id`), category_id: nullableString(property(row, "category_id", path), `${path}.category_id`), memo: nullableString(property(row, "memo", path), `${path}.memo`), converted_transaction_id: nullableString(property(row, "converted_transaction_id", path), `${path}.converted_transaction_id`) }; }
function parseInstallmentPlan(row: JsonRecord, path: string): BackupInstallmentPlan { return { ...owned(row, path), transaction_id: string(property(row, "transaction_id", path), `${path}.transaction_id`), total_amount: positive(property(row, "total_amount", path), `${path}.total_amount`), installment_count: positive(property(row, "installment_count", path), `${path}.installment_count`) > 1 ? Number(row.installment_count) : fail(`${path}.installment_count`, "must be greater than 1"), interest_type: oneOf(property(row, "interest_type", path), `${path}.interest_type`, ["INTEREST_FREE", "INTEREST_BEARING"]), start_month: isoDate(property(row, "start_month", path), `${path}.start_month`) }; }
function parseInstallmentPayment(row: JsonRecord, path: string): BackupInstallmentPayment { return { ...owned(row, path), installment_plan_id: string(property(row, "installment_plan_id", path), `${path}.installment_plan_id`), sequence: positive(property(row, "sequence", path), `${path}.sequence`), scheduled_date: isoDate(property(row, "scheduled_date", path), `${path}.scheduled_date`), principal_amount: nonNegative(property(row, "principal_amount", path), `${path}.principal_amount`), fee_amount: nonNegative(property(row, "fee_amount", path), `${path}.fee_amount`), status: oneOf(property(row, "status", path), `${path}.status`, ["SCHEDULED", "PAID", "CANCELLED"]), settlement_transfer_id: nullableString(property(row, "settlement_transfer_id", path), `${path}.settlement_transfer_id`) }; }
function parseMonthlyBudget(row: JsonRecord, path: string): BackupMonthlyBudget { return { ...owned(row, path), year: between(integer(property(row, "year", path), `${path}.year`), `${path}.year`, 1, 9999), month: between(integer(property(row, "month", path), `${path}.month`), `${path}.month`, 1, 12), total_budget: nonNegative(property(row, "total_budget", path), `${path}.total_budget`) }; }
function parseCategoryBudget(row: JsonRecord, path: string): BackupCategoryBudget { return { ...owned(row, path), year: between(integer(property(row, "year", path), `${path}.year`), `${path}.year`, 1, 9999), month: between(integer(property(row, "month", path), `${path}.month`), `${path}.month`, 1, 12), category_id: string(property(row, "category_id", path), `${path}.category_id`), base_budget: nonNegative(property(row, "base_budget", path), `${path}.base_budget`), rollover_enabled: boolean(property(row, "rollover_enabled", path), `${path}.rollover_enabled`), rollover_amount: integer(property(row, "rollover_amount", path), `${path}.rollover_amount`) }; }
function parseSavingsGoal(row: JsonRecord, path: string): BackupSavingsGoal { return { ...owned(row, path), name: string(property(row, "name", path), `${path}.name`), target_amount: positive(property(row, "target_amount", path), `${path}.target_amount`), target_date: isoDate(property(row, "target_date", path), `${path}.target_date`), monthly_contribution_plan: nonNegative(property(row, "monthly_contribution_plan", path), `${path}.monthly_contribution_plan`), is_active: boolean(property(row, "is_active", path), `${path}.is_active`) }; }
function parseSavingsContribution(row: JsonRecord, path: string): BackupSavingsContribution { const transaction = nullableString(property(row, "transaction_id", path), `${path}.transaction_id`); const transfer = nullableString(property(row, "transfer_id", path), `${path}.transfer_id`); if (transaction !== null && transfer !== null) fail(path, "cannot reference both transaction_id and transfer_id"); return { ...owned(row, path), goal_id: string(property(row, "goal_id", path), `${path}.goal_id`), amount: positive(property(row, "amount", path), `${path}.amount`), contribution_date: isoDate(property(row, "contribution_date", path), `${path}.contribution_date`), transaction_id: transaction, transfer_id: transfer }; }

export function parseBackup(input: unknown): BackupPayload {
  const backup = object(input, "backup");
  const result: BackupPayload = {
    metadata: parseMetadata(object(property(backup, "metadata", "backup"), "metadata")),
    profile: parseProfile(object(property(backup, "profile", "backup"), "profile"), "profile"),
    accounts: rows(property(backup, "accounts", "backup"), "accounts", parseAccount),
    credit_card_settings: rows(property(backup, "credit_card_settings", "backup"), "credit_card_settings", parseCard),
    categories: rows(property(backup, "categories", "backup"), "categories", parseCategory),
    tags: rows(property(backup, "tags", "backup"), "tags", parseTag),
    transactions: rows(property(backup, "transactions", "backup"), "transactions", parseTransaction),
    transaction_tags: rows(property(backup, "transaction_tags", "backup"), "transaction_tags", parseTransactionTag),
    recurring_transactions: rows(property(backup, "recurring_transactions", "backup"), "recurring_transactions", parseRecurring),
    planned_transactions: rows(property(backup, "planned_transactions", "backup"), "planned_transactions", parsePlanned),
    installment_plans: rows(property(backup, "installment_plans", "backup"), "installment_plans", parseInstallmentPlan),
    installment_payments: rows(property(backup, "installment_payments", "backup"), "installment_payments", parseInstallmentPayment),
    monthly_budgets: rows(property(backup, "monthly_budgets", "backup"), "monthly_budgets", parseMonthlyBudget),
    category_budgets: rows(property(backup, "category_budgets", "backup"), "category_budgets", parseCategoryBudget),
    savings_goals: rows(property(backup, "savings_goals", "backup"), "savings_goals", parseSavingsGoal),
    savings_contributions: rows(property(backup, "savings_contributions", "backup"), "savings_contributions", parseSavingsContribution),
  };
  for (const [name, collection] of Object.entries(result)) if (Array.isArray(collection) && collection.length && "id" in collection[0]) validateUniqueIds(collection as { id: string }[], name);
  return result;
}

/** Validates and normalizes an untrusted backup document before any restore write. */
export function validateBackup(input: unknown): BackupPayload {
  return parseBackup(input);
}
