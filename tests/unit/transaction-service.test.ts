import { describe, expect, it } from "vitest";

import { createTransactionService, type TransactionRepository } from "@/server/transactions/service";

const userId = "user-a";
const bank = { id: "bank-a", userId, type: "BANK" as const, isActive: true };

function repository(accounts = [bank]): TransactionRepository {
  return {
    findAccount: async (_userId, id) => accounts.find((account) => account.id === id) ?? null,
    create: async (_userId, input) => ({ id: "transaction-a", userId, ...input }),
    list: async () => [], update: async () => null, remove: async () => false,
  };
}

describe("transaction service", () => {
  it("rejects a transfer whose source and destination are the same account", async () => {
    const service = createTransactionService(repository());
    await expect(service.create(userId, { type: "TRANSFER", amount: 10_000, baseAmount: 10_000, currency: "KRW", transactionAt: "2026-08-11T10:00:00+09:00", fromAccountId: bank.id, toAccountId: bank.id })).rejects.toThrow("distinct");
  });

  it("rejects a KRW transaction with a mismatched historical base amount", async () => {
    const service = createTransactionService(repository());
    await expect(service.create(userId, { type: "EXPENSE", amount: 10_000, baseAmount: 9_000, currency: "KRW", transactionAt: "2026-08-11T10:00:00+09:00", accountId: bank.id })).rejects.toThrow("baseAmount");
  });
});
