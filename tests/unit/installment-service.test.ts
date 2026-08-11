import { describe, expect, it, vi } from "vitest";

import {
  createInstallmentService,
  type InstallmentPurchaseInput,
  type InstallmentRepository,
  type InstallmentSettlementInput,
  type OwnedActiveAccount,
} from "@/server/installments/service";

const userId = "user-a";
const cardAccount: OwnedActiveAccount = { id: "card-a", userId, isActive: true, type: "CREDIT_CARD" };
const bankAccount: OwnedActiveAccount = { id: "bank-a", userId, isActive: true, type: "BANK" };

const purchaseInput: InstallmentPurchaseInput = {
  accountId: cardAccount.id,
  categoryId: "category-a",
  transactionAt: "2026-01-31T00:00:00+09:00",
  amount: 1_000,
  currency: "KRW",
  memo: "Installment purchase",
  installmentCount: 3,
  interestType: "INTEREST_FREE",
  firstPaymentDate: "2026-01-31",
};

const settlementInput: InstallmentSettlementInput = {
  paymentId: "payment-a",
  paymentAccountId: bankAccount.id,
  transactionAt: "2026-01-31T00:00:00+09:00",
};

function repository(options: { accounts?: ReadonlyArray<OwnedActiveAccount> } = {}): InstallmentRepository & {
  createPurchase: ReturnType<typeof vi.fn>;
  settlePayment: ReturnType<typeof vi.fn>;
} {
  const accounts = options.accounts ?? [cardAccount, bankAccount];
  return {
    findAccount: async (_userId, id) => accounts.find((account) => account.id === id) ?? null,
    createPurchase: vi.fn(async () => ({ planId: "plan-1" })),
    settlePayment: vi.fn(async () => ({ transferId: "transfer-1" })),
  };
}

describe("installment service", () => {
  it("rejects a purchase account that is not a CREDIT_CARD", async () => {
    const service = createInstallmentService(repository());

    await expect(service.createPurchase(userId, { ...purchaseInput, accountId: bankAccount.id })).rejects.toThrow("CREDIT_CARD");
  });

  it("rejects a purchase account outside the current user", async () => {
    const service = createInstallmentService(repository({ accounts: [{ ...cardAccount, userId: "other-user" }] }));

    await expect(service.createPurchase(userId, purchaseInput)).rejects.toThrow("CREDIT_CARD");
  });

  it("rejects an inactive purchase account", async () => {
    const service = createInstallmentService(repository({ accounts: [{ ...cardAccount, isActive: false }] }));

    await expect(service.createPurchase(userId, purchaseInput)).rejects.toThrow("CREDIT_CARD");
  });

  it("rejects a foreign currency purchase", async () => {
    const service = createInstallmentService(repository());

    await expect(service.createPurchase(userId, { ...purchaseInput, currency: "USD" })).rejects.toThrow("KRW");
  });

  it("rejects a single installment", async () => {
    const service = createInstallmentService(repository());

    await expect(service.createPurchase(userId, { ...purchaseInput, installmentCount: 1 })).rejects.toThrow("installmentCount");
  });

  it("creates a validated purchase through the repository", async () => {
    const repo = repository();
    const service = createInstallmentService(repo);

    await expect(service.createPurchase(userId, purchaseInput)).resolves.toEqual({ planId: "plan-1" });
    expect(repo.createPurchase).toHaveBeenCalledWith(userId, expect.objectContaining({ installmentCount: 3 }));
  });

  it("rejects a settlement account that is not BANK or CASH", async () => {
    const service = createInstallmentService(repository());

    await expect(service.settlePayment(userId, { ...settlementInput, paymentAccountId: cardAccount.id })).rejects.toThrow("BANK or CASH");
  });

  it("settles a validated payment through the repository", async () => {
    const repo = repository();
    const service = createInstallmentService(repo);

    await expect(service.settlePayment(userId, settlementInput)).resolves.toEqual({ transferId: "transfer-1" });
    expect(repo.settlePayment).toHaveBeenCalledWith(userId, expect.objectContaining({ paymentId: "payment-a" }));
  });
});
