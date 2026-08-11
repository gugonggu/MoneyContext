import { expect, it } from "vitest";

import { groupTransactionsByDate } from "@/domain/transactions/group-by-date";

it("groups transactions that fall on the same date together", () => {
  const transactions = [
    { id: "1", transactionAt: "2026-08-11T09:00:00.000Z" },
    { id: "2", transactionAt: "2026-08-11T18:00:00.000Z" },
    { id: "3", transactionAt: "2026-08-10T09:00:00.000Z" },
  ];

  expect(groupTransactionsByDate(transactions)).toEqual([
    { date: "2026-08-11", transactions: [transactions[0], transactions[1]] },
    { date: "2026-08-10", transactions: [transactions[2]] },
  ]);
});

it("returns an empty array for an empty transaction list", () => {
  expect(groupTransactionsByDate([])).toEqual([]);
});

it("orders groups by first occurrence in the input", () => {
  const transactions = [
    { id: "1", transactionAt: "2026-08-09T00:00:00.000Z" },
    { id: "2", transactionAt: "2026-08-11T00:00:00.000Z" },
    { id: "3", transactionAt: "2026-08-09T12:00:00.000Z" },
  ];

  expect(groupTransactionsByDate(transactions).map((group) => group.date)).toEqual(["2026-08-09", "2026-08-11"]);
});
