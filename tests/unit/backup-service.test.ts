import { describe, expect, it, vi } from "vitest";

import { BACKUP_SCHEMA, BACKUP_SCHEMA_VERSION } from "@/domain/backup/schema";
import { createBackupService, type BackupRepository } from "@/server/backup/service";

const userId = "user-a";

function emptyBackupData() {
  return {
    profile: {
      id: userId,
      display_name: "User A",
      base_currency: "KRW",
      salary_cycle_day: 25,
      timezone: "Asia/Seoul",
      onboarding_completed: true,
    },
    accounts: [],
    credit_card_settings: [],
    categories: [],
    tags: [],
    transactions: [],
    transaction_tags: [],
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

describe("createBackupService", () => {
  it("builds the complete schema-v1 backup for the supplied current user", async () => {
    const getBackupData = vi.fn().mockResolvedValue(emptyBackupData());
    const repository: BackupRepository = { getBackupData };
    const exportedAt = new Date("2026-08-12T00:00:00.000Z");

    const backup = await createBackupService(repository).generate(userId, exportedAt);

    expect(getBackupData).toHaveBeenCalledWith(userId);
    expect(backup).toEqual(expect.objectContaining({
      metadata: {
        schema: BACKUP_SCHEMA,
        schema_version: BACKUP_SCHEMA_VERSION,
        exported_at: "2026-08-12T00:00:00.000Z",
        base_currency: "KRW",
        timezone: "Asia/Seoul",
      },
      profile: emptyBackupData().profile,
      accounts: [],
      credit_card_settings: [],
      categories: [],
      tags: [],
      transactions: [],
      transaction_tags: [],
      recurring_transactions: [],
      planned_transactions: [],
      installment_plans: [],
      installment_payments: [],
      monthly_budgets: [],
      category_budgets: [],
      savings_goals: [],
      savings_contributions: [],
    }));
  });

  it("retries until two validated reads agree before exporting", async () => {
    const first = emptyBackupData();
    const stable = {
      ...emptyBackupData(),
      profile: { ...emptyBackupData().profile, display_name: "Updated User A" },
    };
    const getBackupData = vi.fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(stable)
      .mockResolvedValueOnce(stable);

    const backup = await createBackupService({ getBackupData }).generate(
      userId,
      new Date("2026-08-12T00:00:00.000Z"),
    );

    expect(getBackupData).toHaveBeenCalledTimes(3);
    expect(backup.profile.display_name).toBe("Updated User A");
  });

  it("refuses to export when the financial graph never stabilizes", async () => {
    let read = 0;
    const getBackupData = vi.fn(async () => ({
      ...emptyBackupData(),
      profile: { ...emptyBackupData().profile, display_name: `User A ${read++}` },
    }));

    await expect(createBackupService({ getBackupData }).generate(userId)).rejects.toThrow(
      "backup data changed during export",
    );
  });

  it("retries a torn read whose reference is outside the observed graph", async () => {
    const torn = {
      ...emptyBackupData(),
      transaction_tags: [{ transaction_id: "missing-transaction", tag_id: "missing-tag" }],
    };
    const stable = emptyBackupData();
    const getBackupData = vi.fn()
      .mockResolvedValueOnce(torn)
      .mockResolvedValueOnce(stable)
      .mockResolvedValueOnce(stable);

    const backup = await createBackupService({ getBackupData }).generate(userId);

    expect(getBackupData).toHaveBeenCalledTimes(3);
    expect(backup.transaction_tags).toEqual([]);
  });
});
