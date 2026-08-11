import { expect, it } from "vitest";

import { rankFrequentCategories, rankFrequentCategoryAccountCombos, rankRecentAccounts } from "@/domain/transactions/pattern-recommendations";

const referenceDate = "2026-08-11";

it("ranks accounts higher when used more recently, given equal frequency", () => {
  const transactions = [
    { accountId: "a", categoryId: "food", occurredAt: "2026-08-10" },
    { accountId: "b", categoryId: "food", occurredAt: "2026-08-01" },
  ];

  expect(rankRecentAccounts(transactions, referenceDate)).toEqual([
    { key: "a", score: 1 / 2 },
    { key: "b", score: 1 / 11 },
  ]);
});

it("ranks accounts higher when used more frequently, given similar recency", () => {
  const transactions = [
    { accountId: "a", categoryId: "food", occurredAt: "2026-08-10" },
    { accountId: "a", categoryId: "food", occurredAt: "2026-08-05" },
    { accountId: "b", categoryId: "food", occurredAt: "2026-08-10" },
  ];

  const ranked = rankRecentAccounts(transactions, referenceDate);
  expect(ranked[0]).toEqual({ key: "a", score: 1 / 2 + 1 / 7 });
  expect(ranked[1]).toEqual({ key: "b", score: 1 / 2 });
});

it("ignores transactions without a category when ranking categories", () => {
  const transactions = [
    { accountId: "a", occurredAt: "2026-08-10" },
    { accountId: "a", categoryId: "food", occurredAt: "2026-08-09" },
  ];

  expect(rankFrequentCategories(transactions, referenceDate)).toEqual([{ key: "food", score: 1 / 3 }]);
});

it("ranks category and account combinations independently of single-dimension ranks", () => {
  const transactions = [
    { accountId: "card", categoryId: "food", occurredAt: "2026-08-10" },
    { accountId: "card", categoryId: "food", occurredAt: "2026-08-09" },
    { accountId: "bank", categoryId: "food", occurredAt: "2026-08-10" },
  ];

  expect(rankFrequentCategoryAccountCombos(transactions, referenceDate)).toEqual([
    { key: "food:card", score: 1 / 2 + 1 / 3 },
    { key: "food:bank", score: 1 / 2 },
  ]);
});

it("excludes future-dated transactions relative to the reference date", () => {
  const transactions = [{ accountId: "a", categoryId: "food", occurredAt: "2026-08-12" }];

  expect(rankRecentAccounts(transactions, referenceDate)).toEqual([]);
});

it("limits results to the requested count, breaking ties by key", () => {
  const transactions = [
    { accountId: "b", categoryId: "food", occurredAt: "2026-08-10" },
    { accountId: "a", categoryId: "food", occurredAt: "2026-08-10" },
    { accountId: "c", categoryId: "food", occurredAt: "2026-08-10" },
  ];

  expect(rankRecentAccounts(transactions, referenceDate, 2)).toEqual([
    { key: "a", score: 1 / 2 },
    { key: "b", score: 1 / 2 },
  ]);
});
