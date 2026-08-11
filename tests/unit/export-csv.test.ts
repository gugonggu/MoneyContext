import { describe, expect, it } from "vitest";

import { generateTransactionCsv } from "@/domain/export/csv";
import type { ExportReadModel } from "@/domain/export/markdown";

function readModel(overrides: Partial<ExportReadModel> = {}): ExportReadModel {
  return {
    generatedAt: "2026-08-11T03:00:00.000Z",
    baseCurrency: "KRW",
    period: { startDate: "2026-08-01", endDate: "2026-08-31" },
    preset: "SPENDING_REVIEW",
    financialPosition: { totalAssets: 0, totalLiabilities: 0, creditCardOutstanding: 0, netWorth: 0 },
    transactions: [
      {
        id: "first",
        transactionDate: "2026-07-31T15:00:00.000Z",
        type: "EXPENSE",
        status: "CONFIRMED",
        originalAmount: 10,
        originalCurrency: "USD",
        baseAmount: 1_500,
        categoryName: "Food, dining",
        accountName: "Main \"Card\"",
        tagNames: ["trip", "weekend"],
        memo: "line one\nline two",
      },
      {
        id: "before-period-in-seoul",
        transactionDate: "2026-07-31T14:59:59.999Z",
        type: "EXPENSE",
        status: "CONFIRMED",
        baseAmount: 2_000,
      },
    ],
    budgets: [],
    plannedCashflows: [],
    savingsGoals: [],
    ...overrides,
  };
}

describe("generateTransactionCsv", () => {
  it("writes the documented header and selected transaction values in order with a UTF-8 BOM", () => {
    const csv = generateTransactionCsv(readModel());

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.split("\r\n")[0]).toBe("\uFEFFtransaction_date,transaction_type,status,memo,category,tags,account,from_account,to_account,original_amount,original_currency,base_amount,base_currency");
    expect(csv).toContain("2026-08-01,EXPENSE,CONFIRMED");
    expect(csv).toContain(",10,USD,1500,KRW");
    expect(csv).not.toContain("2000");
  });

  it("escapes comma, quote, and newline cells using RFC-style CSV quoting", () => {
    const csv = generateTransactionCsv(readModel());

    expect(csv).toContain('"line one\nline two"');
    expect(csv).toContain('"Food, dining"');
    expect(csv).toContain('"Main ""Card"""');
    expect(csv).toContain('"trip,weekend"');
  });
});
