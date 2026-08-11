import { describe, expect, it, vi } from "vitest";

import { createTransactionService, type TransactionRepository } from "@/server/transactions/service";

const userId = "user-a";
const bank = { id: "bank-a", userId, type: "BANK" as const, isActive: true };
const bankB = { id: "bank-b", userId, type: "BANK" as const, isActive: true };
const category = { id: "category-a", userId, isActive: true };

function repository(accounts = [bank, bankB], categories = [category]): TransactionRepository & { listRecentForPatterns: ReturnType<typeof vi.fn> } {
  return {
    findAccount: async (_userId, id) => accounts.find((account) => account.id === id) ?? null,
    findCategory: async (_userId, id) => categories.find((item) => item.id === id) ?? null,
    create: async (_userId, input) => ({ id: "transaction-a", userId, ...input }),
    list: async () => [], update: async () => null, remove: async () => false,
    listRecentForPatterns: vi.fn(async () => []),
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

  it("persists an owned active category on an EXPENSE transaction", async () => {
    const service = createTransactionService(repository());
    await expect(service.create(userId, { type: "EXPENSE", amount: 10_000, baseAmount: 10_000, currency: "KRW", transactionAt: "2026-08-11T10:00:00+09:00", accountId: bank.id, categoryId: category.id })).resolves.toMatchObject({ categoryId: category.id });
  });

  it("rejects a category outside the current user", async () => {
    const service = createTransactionService(repository());
    await expect(service.create(userId, { type: "EXPENSE", amount: 10_000, baseAmount: 10_000, currency: "KRW", transactionAt: "2026-08-11T10:00:00+09:00", accountId: bank.id, categoryId: "other-user-category" })).rejects.toThrow("active category owned");
  });

  it("clears categoryId on a TRANSFER even if supplied", async () => {
    const service = createTransactionService(repository());
    await expect(service.create(userId, { type: "TRANSFER", amount: 10_000, baseAmount: 10_000, currency: "KRW", transactionAt: "2026-08-11T10:00:00+09:00", fromAccountId: bank.id, toAccountId: bankB.id, categoryId: category.id })).resolves.toMatchObject({ categoryId: undefined });
  });

  it("clamps the recent-pattern query limit to a positive integer within the allowed range", async () => {
    const repo = repository();
    const service = createTransactionService(repo);

    await service.listRecentForPatterns(userId, 0);
    expect(repo.listRecentForPatterns).toHaveBeenCalledWith(userId, 1);

    await service.listRecentForPatterns(userId, 5_000);
    expect(repo.listRecentForPatterns).toHaveBeenCalledWith(userId, 500);

    await service.listRecentForPatterns(userId);
    expect(repo.listRecentForPatterns).toHaveBeenCalledWith(userId, 200);
  });
});
