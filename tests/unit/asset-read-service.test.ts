import { describe, expect, it } from "vitest";

import {
  createAssetReadService,
  type AssetAccountRecord,
  type AssetCardSettingsRecord,
  type AssetInstallmentPaymentRecord,
  type AssetReadRepository,
  type AssetTransactionRecord,
} from "@/server/assets/service";

const userId = "user-a";

const accounts: readonly AssetAccountRecord[] = [
  { id: "bank-a", userId, name: "Main bank", type: "BANK", initialBalance: 1_000, linkedAccountId: null, sortOrder: 1 },
  { id: "cash-a", userId, name: "Wallet", type: "CASH", initialBalance: 400, linkedAccountId: null, sortOrder: 2 },
  { id: "debit-a", userId, name: "Debit card", type: "DEBIT", initialBalance: 0, linkedAccountId: "bank-a", sortOrder: 3 },
  { id: "loan-a", userId, name: "Loan", type: "LIABILITY", initialBalance: 750, linkedAccountId: null, sortOrder: 4 },
  { id: "card-a", userId, name: "Credit card", type: "CREDIT_CARD", initialBalance: 0, linkedAccountId: null, sortOrder: 5 },
  { id: "other-bank", userId: "user-b", name: "Other bank", type: "BANK", initialBalance: 999_999, linkedAccountId: null, sortOrder: 1 },
];

const transactions: readonly AssetTransactionRecord[] = [
  { id: "income", userId, type: "INCOME", status: "CONFIRMED", amount: 500, accountId: "bank-a" },
  { id: "debit-expense", userId, type: "EXPENSE", status: "CONFIRMED", amount: 300, accountId: "debit-a" },
  { id: "cash-expense", userId, type: "EXPENSE", status: "CONFIRMED", amount: 50, accountId: "cash-a" },
  { id: "loan-payment", userId, type: "EXPENSE", status: "CONFIRMED", amount: 50, accountId: "loan-a" },
  { id: "card-purchase", userId, type: "EXPENSE", status: "CONFIRMED", amount: 600, accountId: "card-a" },
  { id: "card-settlement", userId, type: "TRANSFER", status: "CONFIRMED", amount: 200, fromAccountId: "bank-a", toAccountId: "card-a" },
  { id: "pending-card-purchase", userId, type: "EXPENSE", status: "PENDING", amount: 100, accountId: "card-a" },
  { id: "other-transaction", userId: "user-b", type: "INCOME", status: "CONFIRMED", amount: 999_999, accountId: "other-bank" },
];

const cardSettings: readonly AssetCardSettingsRecord[] = [
  { id: "settings-a", userId, accountId: "card-a", paymentAccountId: "bank-a", paymentDay: 25, creditLimit: 2_000 },
  { id: "settings-b", userId: "user-b", accountId: "other-card", paymentAccountId: "other-bank", paymentDay: 20, creditLimit: 1_000 },
];

const installments: readonly AssetInstallmentPaymentRecord[] = [
  { id: "payment-1", userId, cardAccountId: "card-a", sequence: 1, scheduledDate: "2026-09-10", principalAmount: 250, feeAmount: 10, status: "SCHEDULED" },
  { id: "payment-2", userId, cardAccountId: "card-a", sequence: 2, scheduledDate: "2026-10-10", principalAmount: 250, feeAmount: 0, status: "SCHEDULED" },
  { id: "paid-payment", userId, cardAccountId: "card-a", sequence: 0, scheduledDate: "2026-08-10", principalAmount: 100, feeAmount: 0, status: "PAID" },
  { id: "other-payment", userId: "user-b", cardAccountId: "other-card", sequence: 1, scheduledDate: "2026-09-01", principalAmount: 999_999, feeAmount: 0, status: "SCHEDULED" },
];

function createRepository(): AssetReadRepository & { readonly requestedUserIds: string[] } {
  const requestedUserIds: string[] = [];
  const scoped = <T extends { userId: string }>(rows: readonly T[], ownerId: string) => rows.filter((row) => row.userId === ownerId);

  return {
    requestedUserIds,
    listAccounts: async (ownerId) => { requestedUserIds.push(ownerId); return scoped(accounts, ownerId); },
    listTransactions: async (ownerId) => { requestedUserIds.push(ownerId); return scoped(transactions, ownerId); },
    listCardSettings: async (ownerId) => { requestedUserIds.push(ownerId); return scoped(cardSettings, ownerId); },
    listInstallmentPayments: async (ownerId) => { requestedUserIds.push(ownerId); return scoped(installments, ownerId); },
  };
}

describe("asset read service", () => {
  it("groups account balances and applies DEBIT spending to its linked BANK account", async () => {
    const service = createAssetReadService(createRepository());

    const overview = await service.getOverview(userId);

    expect(overview.accounts).toEqual({
      bank: [{ id: "bank-a", name: "Main bank", type: "BANK", balance: 1_000, linkedAccountId: null }],
      cash: [{ id: "cash-a", name: "Wallet", type: "CASH", balance: 350, linkedAccountId: null }],
      debit: [{ id: "debit-a", name: "Debit card", type: "DEBIT", balance: 0, linkedAccountId: "bank-a" }],
      liability: [{ id: "loan-a", name: "Loan", type: "LIABILITY", balance: 700, linkedAccountId: null }],
    });
  });

  it("excludes DEBIT payment methods from liquid assets and calculates net worth", async () => {
    const service = createAssetReadService(createRepository());

    const overview = await service.getOverview(userId);

    expect(overview.liquidAssets).toBe(1_350);
    expect(overview.liabilities).toBe(700);
    expect(overview.netWorth).toBe(250);
  });

  it("maps card outstanding, available limit, next payment, and installment schedule", async () => {
    const service = createAssetReadService(createRepository());

    const overview = await service.getOverview(userId);

    expect(overview.cards).toEqual([{
      id: "card-a",
      name: "Credit card",
      outstanding: 400,
      availableLimit: 1_600,
      nextPaymentDate: "2026-09-10",
      installmentSchedule: [
        { id: "paid-payment", sequence: 0, scheduledDate: "2026-08-10", principalAmount: 100, feeAmount: 0, status: "PAID" },
        { id: "payment-1", sequence: 1, scheduledDate: "2026-09-10", principalAmount: 250, feeAmount: 10, status: "SCHEDULED" },
        { id: "payment-2", sequence: 2, scheduledDate: "2026-10-10", principalAmount: 250, feeAmount: 0, status: "SCHEDULED" },
      ],
    }]);
  });

  it("requests every read model with the current user and never returns another user's rows", async () => {
    const repository = createRepository();
    const service = createAssetReadService(repository);

    const overview = await service.getOverview(userId);

    expect(repository.requestedUserIds).toEqual([userId, userId, userId, userId]);
    expect(overview.accounts.bank).not.toContainEqual(expect.objectContaining({ id: "other-bank" }));
    expect(overview.cards).not.toContainEqual(expect.objectContaining({ id: "other-card" }));
  });
});
