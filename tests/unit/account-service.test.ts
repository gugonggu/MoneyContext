import { describe, expect, it } from "vitest";

import { createAccountService, type AccountRepository } from "@/server/accounts/service";

const userId = "user-a";
const bank = {
  id: "bank-a",
  userId,
  name: "생활비 계좌",
  type: "BANK" as const,
  initialBalance: 0,
  linkedAccountId: null,
  isActive: true,
  sortOrder: 0,
};

function createRepository(accounts = [bank]): AccountRepository {
  return {
    list: async (_userId, activeOnly) => accounts.filter((account) => !activeOnly || account.isActive),
    findById: async (_userId, accountId) => accounts.find((account) => account.id === accountId) ?? null,
    create: async (_userId, input) => ({ id: "created", userId, ...input, isActive: true }),
    update: async () => null,
    deactivate: async () => false,
    createCreditCardSettings: async (_userId, input) => ({ id: "card-setting-a", userId, ...input }),
    updateCreditCardSettings: async (_userId, accountId, input) => ({ id: "card-setting-a", userId, accountId, ...input }),
    listCreditCardSettings: async () => [],
  };
}

describe("account service", () => {
  it("lists only active accounts by default", async () => {
    const service = createAccountService(createRepository());

    await expect(service.list(userId)).resolves.toEqual([bank]);
  });

  it("rejects a DEBIT account when its linked account is not the user's BANK account", async () => {
    const service = createAccountService(createRepository());

    await expect(service.create(userId, {
      name: "체크카드",
      type: "DEBIT",
      initialBalance: 0,
      linkedAccountId: "another-users-bank",
    })).rejects.toThrow("linked BANK account");
  });

  it("normalizes a valid DEBIT account before persisting it", async () => {
    let persistedName = "";
    const repository = createRepository();
    repository.create = async (_userId, input) => {
      persistedName = input.name;
      return { id: "debit-a", userId, ...input, isActive: true };
    };
    const service = createAccountService(repository);

    const account = await service.create(userId, {
      name: "  체크카드  ",
      type: "DEBIT",
      initialBalance: 0,
      linkedAccountId: bank.id,
    });

    expect(persistedName).toBe("체크카드");
    expect(account.linkedAccountId).toBe(bank.id);
  });

  it("rejects a negative initial balance", async () => {
    const service = createAccountService(createRepository());

    await expect(service.create(userId, {
      name: "현금",
      type: "CASH",
      initialBalance: -1,
    })).rejects.toThrow("initialBalance must be a non-negative integer");
  });

  it("rejects credit-card settings whose payment account is not the user's active BANK account", async () => {
    const service = createAccountService(createRepository([
      { ...bank, id: "card-a", type: "CREDIT_CARD" },
      { ...bank, id: "inactive-bank", isActive: false },
    ]));

    await expect(service.createCreditCardSettings(userId, {
      accountId: "card-a",
      paymentAccountId: "inactive-bank",
      paymentDay: 25,
      creditLimit: 1_000_000,
    })).rejects.toThrow("active BANK account");
  });

  it("updates credit-card settings when the payment account is a valid active BANK account", async () => {
    const service = createAccountService(createRepository([
      { ...bank, id: "card-a", type: "CREDIT_CARD" },
      { ...bank, id: "bank-b", name: "다른 은행" },
    ]));

    await expect(service.updateCreditCardSettings("user-a", "card-a", {
      paymentAccountId: "bank-b",
      paymentDay: 15,
      creditLimit: 2_000_000,
    })).resolves.toMatchObject({ paymentAccountId: "bank-b", paymentDay: 15, creditLimit: 2_000_000 });
  });

  it("rejects updating credit-card settings when the target account is not an active CREDIT_CARD", async () => {
    const service = createAccountService(createRepository());

    await expect(service.updateCreditCardSettings(userId, "bank-a", {
      paymentAccountId: bank.id,
      paymentDay: 15,
    })).rejects.toThrow("active CREDIT_CARD account");
  });

  it("accepts a well-formed first payment date on a new credit card (e.g. a card issued mid-cycle)", async () => {
    const service = createAccountService(createRepository([bank, { ...bank, id: "card-a", type: "CREDIT_CARD" }]));

    await expect(service.createCreditCardSettings(userId, {
      accountId: "card-a",
      paymentAccountId: bank.id,
      paymentDay: 14,
      firstPaymentDate: "2026-09-14",
    })).resolves.toMatchObject({ firstPaymentDate: "2026-09-14" });
  });

  it("rejects a malformed first payment date", async () => {
    const service = createAccountService(createRepository([bank, { ...bank, id: "card-a", type: "CREDIT_CARD" }]));

    await expect(service.createCreditCardSettings(userId, {
      accountId: "card-a",
      paymentAccountId: bank.id,
      paymentDay: 14,
      firstPaymentDate: "September 14",
    })).rejects.toThrow("firstPaymentDate must be a YYYY-MM-DD date");
  });
});
