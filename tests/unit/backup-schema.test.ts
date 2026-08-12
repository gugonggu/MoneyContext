import { describe, expect, it } from "vitest";

import { parseBackup } from "@/domain/backup/validate";
import type { BackupPayload } from "@/domain/backup/schema";

const OLD_USER_ID = "user-from-file";

function validBackup(): BackupPayload {
  return {
    metadata: {
      schema: "money-context-backup",
      schema_version: 1,
      exported_at: "2026-08-12T09:00:00+09:00",
      base_currency: "KRW",
      timezone: "Asia/Seoul",
    },
    profile: { id: OLD_USER_ID, display_name: "Backup user", role: "USER", base_currency: "KRW", salary_cycle_day: 25, timezone: "Asia/Seoul", onboarding_completed: true },
    accounts: [{ id: "bank", user_id: OLD_USER_ID, name: "Bank", type: "BANK", initial_balance: 500_000, linked_account_id: null, is_active: true, sort_order: 0 }],
    credit_card_settings: [],
    categories: [{ id: "food", user_id: OLD_USER_ID, name: "Food", kind: "EXPENSE", is_system_default: false, is_active: true, sort_order: 0 }],
    tags: [{ id: "dining", user_id: OLD_USER_ID, name: "Dining", is_active: true }],
    transactions: [{ id: "expense", user_id: OLD_USER_ID, type: "EXPENSE", status: "CONFIRMED", transaction_at: "2026-08-12T00:00:00.000Z", amount: 1_000, currency: "KRW", base_amount: 1_000, base_currency: "KRW", exchange_rate: null, category_id: "food", account_id: "bank", from_account_id: null, to_account_id: null, memo: null, recurring_rule_id: null, recurring_occurrence_date: null, planned_transaction_id: null }],
    transaction_tags: [{ transaction_id: "expense", tag_id: "dining" }],
    recurring_transactions: [],
    planned_transactions: [],
    installment_plans: [],
    installment_payments: [],
    monthly_budgets: [],
    category_budgets: [],
    savings_goals: [],
    savings_contributions: [],
  };
}

describe("parseBackup", () => {
  it("accepts the complete v1 backup shape with Seoul metadata", () => {
    expect(parseBackup(validBackup())).toEqual(validBackup());
  });

  it("rejects a backup whose v1 metadata or required collections are invalid", () => {
    const unsupportedVersion = validBackup();
    unsupportedVersion.metadata.schema_version = 2 as 1;
    expect(() => parseBackup(unsupportedVersion)).toThrow(/schema_version/);

    const missingCollection = validBackup() as Record<string, unknown>;
    delete missingCollection.transaction_tags;
    expect(() => parseBackup(missingCollection)).toThrow(/transaction_tags/);
  });

  it("rejects invalid enums, unsafe amounts, and invalid dates before restore", () => {
    const badEnum = validBackup();
    badEnum.accounts[0].type = "BROKEN" as "BANK";
    expect(() => parseBackup(badEnum)).toThrow(/accounts\[0\].type/);

    const unsafeAmount = validBackup();
    unsafeAmount.transactions[0].amount = 1.5;
    expect(() => parseBackup(unsafeAmount)).toThrow(/transactions\[0\].amount/);

    const badDate = validBackup();
    badDate.transactions[0].transaction_at = "not-a-date";
    expect(() => parseBackup(badDate)).toThrow(/transactions\[0\].transaction_at/);
  });
});
