import { describe, expect, it } from "vitest";

import { createReconciliationService, type ReconciliationRepository } from "@/server/assets/reconciliation";

const userId = "user-a";

function repository(calculatedBalance = 1_000, account = { id: "bank-a", userId, isActive: true }): ReconciliationRepository {
  return {
    findAccount: async () => account,
    getCalculatedBalance: async () => calculatedBalance,
  };
}

describe("account reconciliation", () => {
  it("rejects an unowned or inactive account", async () => {
    const unowned = createReconciliationService(repository(1_000, null), { create: async () => { throw new Error("must not create"); } });
    const inactive = createReconciliationService(repository(1_000, { id: "bank-a", userId, isActive: false }), { create: async () => { throw new Error("must not create"); } });

    await expect(unowned.reconcileAccount(userId, { accountId: "other-bank", actualBalance: 1_000, transactionAt: "2026-08-11T00:00:00.000Z" })).rejects.toThrow("active account owned");
    await expect(inactive.reconcileAccount(userId, { accountId: "bank-a", actualBalance: 1_000, transactionAt: "2026-08-11T00:00:00.000Z" })).rejects.toThrow("active account owned");
  });

  it("rejects a non-integer actual balance", async () => {
    const service = createReconciliationService(repository(), { create: async () => { throw new Error("must not create"); } });

    await expect(service.reconcileAccount(userId, { accountId: "bank-a", actualBalance: 1.5, transactionAt: "2026-08-11T00:00:00.000Z" })).rejects.toThrow("actualBalance must be a safe integer");
  });

  it("does not create an adjustment when the actual and calculated balances match", async () => {
    const service = createReconciliationService(repository(), { create: async () => { throw new Error("must not create"); } });

    await expect(service.reconcileAccount(userId, { accountId: "bank-a", actualBalance: 1_000, transactionAt: "2026-08-11T00:00:00.000Z" })).resolves.toEqual({ created: false, difference: 0 });
  });

  it("creates a signed ADJUSTMENT for the actual-minus-calculated difference", async () => {
    const created: unknown[] = [];
    const service = createReconciliationService(repository(), { create: async (_userId, input) => { created.push(input); return { id: "adjustment-a", userId, ...input }; } });

    await expect(service.reconcileAccount(userId, { accountId: "bank-a", actualBalance: 900, transactionAt: "2026-08-11T00:00:00.000Z" })).resolves.toEqual({ created: true, difference: -100 });
    expect(created).toEqual([{
      type: "ADJUSTMENT", amount: -100, baseAmount: -100, currency: "KRW", transactionAt: "2026-08-11T00:00:00.000Z", accountId: "bank-a", memo: "Balance reconciliation",
    }]);
  });
});
