export const BACKUP_SCHEMA = "money-context-backup" as const;
export const BACKUP_SCHEMA_VERSION = 1 as const;
export const BACKUP_TIMEZONE = "Asia/Seoul" as const;

export const BACKUP_COLLECTIONS = [
  "accounts",
  "credit_card_settings",
  "categories",
  "tags",
  "transactions",
  "transaction_tags",
  "recurring_transactions",
  "planned_transactions",
  "installment_plans",
  "installment_payments",
  "monthly_budgets",
  "category_budgets",
  "savings_goals",
  "savings_contributions",
] as const;

export type BackupMetadata = {
  schema: typeof BACKUP_SCHEMA;
  schema_version: typeof BACKUP_SCHEMA_VERSION;
  exported_at: string;
  base_currency: string;
  timezone: typeof BACKUP_TIMEZONE;
};

export type BackupProfile = {
  id: string;
  display_name: string;
  base_currency: string;
  salary_cycle_day: number;
  timezone: string;
  onboarding_completed: boolean;
};

export type BackupAccount = { id: string; user_id: string; name: string; type: "BANK" | "CASH" | "DEBIT" | "CREDIT_CARD" | "LIABILITY"; initial_balance: number; linked_account_id: string | null; is_active: boolean; sort_order: number };
export type BackupCreditCardSettings = { id: string; user_id: string; account_id: string; payment_day: number; payment_account_id: string; credit_limit: number | null; billing_cycle_start_offset: number | null; billing_cycle_end_offset: number | null; billing_cycle_rule: Record<string, unknown> };
export type BackupCategory = { id: string; user_id: string; name: string; kind: "INCOME" | "EXPENSE" | "BOTH"; is_system_default: boolean; is_active: boolean; sort_order: number };
export type BackupTag = { id: string; user_id: string; name: string; is_active: boolean };
export type BackupTransaction = { id: string; user_id: string; type: "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT"; status: "PENDING" | "CONFIRMED" | "CANCELLED"; transaction_at: string; amount: number; currency: string; base_amount: number; base_currency: string; exchange_rate: number | null; category_id: string | null; account_id: string | null; from_account_id: string | null; to_account_id: string | null; memo: string | null; recurring_rule_id: string | null; recurring_occurrence_date: string | null; planned_transaction_id: string | null };
export type BackupTransactionTag = { transaction_id: string; tag_id: string };
export type BackupRecurringTransaction = { id: string; user_id: string; type: "INCOME" | "EXPENSE"; amount: number; currency: string; account_id: string; category_id: string | null; memo: string | null; frequency: string; interval_count: number; day_of_month: number | null; start_date: string; end_date: string | null; next_run_date: string; confirmation_mode: "AUTO_CONFIRM" | "REQUIRE_CONFIRMATION"; is_active: boolean };
export type BackupPlannedTransaction = { id: string; user_id: string; type: "INCOME" | "EXPENSE"; status: "PLANNED" | "CONFIRMED" | "CANCELLED"; scheduled_date: string; amount: number; currency: string; base_amount: number | null; base_currency: string; exchange_rate: number | null; account_id: string | null; category_id: string | null; memo: string | null; converted_transaction_id: string | null };
export type BackupInstallmentPlan = { id: string; user_id: string; transaction_id: string; total_amount: number; installment_count: number; interest_type: "INTEREST_FREE" | "INTEREST_BEARING"; start_month: string };
export type BackupInstallmentPayment = { id: string; user_id: string; installment_plan_id: string; sequence: number; scheduled_date: string; principal_amount: number; fee_amount: number; status: "SCHEDULED" | "PAID" | "CANCELLED"; settlement_transfer_id: string | null };
export type BackupMonthlyBudget = { id: string; user_id: string; year: number; month: number; total_budget: number };
export type BackupCategoryBudget = { id: string; user_id: string; year: number; month: number; category_id: string; base_budget: number; rollover_enabled: boolean; rollover_amount: number };
export type BackupSavingsGoal = { id: string; user_id: string; name: string; target_amount: number; target_date: string; monthly_contribution_plan: number; is_active: boolean };
export type BackupSavingsContribution = { id: string; user_id: string; goal_id: string; amount: number; contribution_date: string; transaction_id: string | null; transfer_id: string | null };

export type BackupPayload = {
  metadata: BackupMetadata;
  profile: BackupProfile;
  accounts: BackupAccount[];
  credit_card_settings: BackupCreditCardSettings[];
  categories: BackupCategory[];
  tags: BackupTag[];
  transactions: BackupTransaction[];
  transaction_tags: BackupTransactionTag[];
  recurring_transactions: BackupRecurringTransaction[];
  planned_transactions: BackupPlannedTransaction[];
  installment_plans: BackupInstallmentPlan[];
  installment_payments: BackupInstallmentPayment[];
  monthly_budgets: BackupMonthlyBudget[];
  category_budgets: BackupCategoryBudget[];
  savings_goals: BackupSavingsGoal[];
  savings_contributions: BackupSavingsContribution[];
};
