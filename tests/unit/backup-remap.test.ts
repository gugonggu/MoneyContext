import { describe, expect, it } from "vitest";

import { remapBackup } from "@/domain/backup/remap";
import type { BackupPayload } from "@/domain/backup/schema";

const OLD_USER_ID = "untrusted-user-id";
const CURRENT_USER_ID = "current-user-id";

function backupWithReferences(): BackupPayload {
  return {
    metadata: { schema: "money-context-backup", schema_version: 1, exported_at: "2026-08-12T09:00:00+09:00", base_currency: "KRW", timezone: "Asia/Seoul" },
    profile: { id: OLD_USER_ID, display_name: "Backup user", role: "USER", base_currency: "KRW", salary_cycle_day: 25, timezone: "Asia/Seoul", onboarding_completed: true } as unknown as BackupPayload["profile"],
    accounts: [
      { id: "bank", user_id: OLD_USER_ID, name: "Bank", type: "BANK", initial_balance: 500_000, linked_account_id: null, is_active: true, sort_order: 0 },
      { id: "debit", user_id: "another-user-id", name: "Debit", type: "DEBIT", initial_balance: 0, linked_account_id: "bank", is_active: true, sort_order: 1 },
    ],
    credit_card_settings: [],
    categories: [{ id: "food", user_id: OLD_USER_ID, name: "Food", kind: "EXPENSE", is_system_default: false, is_active: true, sort_order: 0 }],
    tags: [{ id: "dining", user_id: OLD_USER_ID, name: "Dining", is_active: true }],
    transactions: [{ id: "expense", user_id: OLD_USER_ID, type: "EXPENSE", status: "CONFIRMED", transaction_at: "2026-08-12T00:00:00.000Z", amount: 1_000, currency: "KRW", base_amount: 1_000, base_currency: "KRW", exchange_rate: null, category_id: "food", account_id: "debit", from_account_id: null, to_account_id: null, memo: null, recurring_rule_id: null, recurring_occurrence_date: null, planned_transaction_id: null }],
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

describe("remapBackup", () => {
  it("creates deterministic fresh ids and replaces every payload user id with the current user", () => {
    const ids = ["new-bank", "new-debit", "new-food", "new-dining", "new-expense"];
    const result = remapBackup(backupWithReferences(), CURRENT_USER_ID, () => ids.shift()!);

    expect(Object.fromEntries(result.idMaps.accounts)).toEqual({ bank: "new-bank", debit: "new-debit" });
    expect(result.payload.profile.id).toBe(CURRENT_USER_ID);
    expect(result.payload.accounts).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "new-bank", user_id: CURRENT_USER_ID }),
      expect.objectContaining({ id: "new-debit", user_id: CURRENT_USER_ID, linked_account_id: "new-bank" }),
    ]));
    expect(result.payload.transactions[0]).toEqual(expect.objectContaining({
      id: "new-expense", user_id: CURRENT_USER_ID, account_id: "new-debit", category_id: "new-food",
    }));
    expect(result.payload.transaction_tags).toEqual([{ transaction_id: "new-expense", tag_id: "new-dining" }]);
  });

  it("rejects references that do not exist in the backup graph", () => {
    const backup = backupWithReferences();
    backup.transactions[0].category_id = "outside-backup";

    let next = 0;
    expect(() => remapBackup(backup, CURRENT_USER_ID, () => `fresh-${next++}`)).toThrow(/category_id.*outside the backup graph/);
  });

  it.each(["toString", "__proto__"])("rejects inherited-property-like dangling references (%s)", (danglingId) => {
    const backup = backupWithReferences();
    backup.transactions[0].category_id = danglingId;

    let next = 0;
    expect(() => remapBackup(backup, CURRENT_USER_ID, () => `fresh-${next++}`)).toThrow(/category_id.*outside the backup graph/);
  });

  it("rejects a duplicate generated id before producing a partially remapped payload", () => {
    expect(() => remapBackup(backupWithReferences(), CURRENT_USER_ID, () => "duplicate-id"))
      .toThrow(/id generator must return unique non-empty ids/);
  });

  it("drops a forged backup ADMIN role instead of carrying authorization state into restore", () => {
    const forgedBackup = backupWithReferences() as BackupPayload & { profile: { role: "ADMIN" } };
    forgedBackup.profile.role = "ADMIN";
    const ids = ["new-bank", "new-debit", "new-food", "new-dining", "new-expense"];

    const result = remapBackup(forgedBackup, CURRENT_USER_ID, () => ids.shift()!);

    expect(result.payload.profile).not.toHaveProperty("role");
  });
});
