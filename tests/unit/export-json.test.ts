import { describe, expect, it } from "vitest";

import { generateAnalysisJson } from "@/domain/export/analysis-json";
import type { ExportReadModel } from "@/domain/export/markdown";

function readModel(overrides: Partial<ExportReadModel> = {}): ExportReadModel {
  return {
    generatedAt: "2026-08-11T03:00:00.000Z",
    baseCurrency: "KRW",
    period: { startDate: "2026-08-01", endDate: "2026-08-31" },
    preset: "SPENDING_REVIEW",
    financialPosition: {
      totalAssets: 5_000_000,
      totalLiabilities: 1_000_000,
      creditCardOutstanding: 200_000,
      netWorth: 3_800_000,
    },
    transactions: [
      {
        id: "foreign-expense",
        transactionDate: "2026-07-31T15:00:00.000Z",
        type: "EXPENSE",
        status: "CONFIRMED",
        originalAmount: 10,
        originalCurrency: "USD",
        baseAmount: 1_500,
        categoryName: "Food",
        accountName: "Card",
        tagNames: ["travel"],
        memo: "Dinner",
      },
      {
        id: "before-period-in-seoul",
        transactionDate: "2026-07-31T14:59:59.999Z",
        type: "EXPENSE",
        status: "CONFIRMED",
        baseAmount: 2_000,
      },
    ],
    budgets: [{ name: "August", allocatedBaseAmount: 500_000, actualUsageBaseAmount: 1_500 }],
    creditCards: [{ name: "Card", outstandingBaseAmount: 200_000, nextPaymentDate: "2026-08-25" }],
    plannedCashflows: [{ scheduledDate: "2026-08-20", type: "EXPENSE", status: "PLANNED", baseAmount: 80_000, memo: "Phone" }],
    savingsGoals: [{ name: "Emergency", targetBaseAmount: 10_000_000, contributedBaseAmount: 2_000_000, targetDate: "2027-01-01" }],
    ...overrides,
  };
}

describe("generateAnalysisJson", () => {
  it("returns the analysis schema v1 with the documented top-level structure", () => {
    const result = generateAnalysisJson(readModel());

    expect(Object.keys(result)).toEqual([
      "metadata",
      "period",
      "financial_position",
      "period_summary",
      "budgets",
      "credit_cards",
      "savings_goals",
      "planned_cashflows",
      "statistics",
      "transactions",
    ]);
    expect(result.metadata).toEqual({
      schema: "money-context-analysis",
      schema_version: 1,
      generated_at: "2026-08-11T03:00:00.000Z",
      base_currency: "KRW",
      timezone: "Asia/Seoul",
      preset: "SPENDING_REVIEW",
    });
    expect(result.period).toEqual({ start_date: "2026-08-01", end_date: "2026-08-31" });
  });

  it("uses the stored base amount and Seoul date for period analysis", () => {
    const result = generateAnalysisJson(readModel());

    expect(result.period_summary).toEqual({
      income_base_amount: 0,
      expense_base_amount: 1_500,
      net_cashflow_base_amount: -1_500,
    });
    expect(result.transactions).toEqual([expect.objectContaining({
      transaction_date: "2026-08-01",
      original_amount: 10,
      original_currency: "USD",
      base_amount: 1_500,
      base_currency: "KRW",
    })]);
  });

  it("preserves signed safe integer amounts for balance adjustments", () => {
    const result = generateAnalysisJson(readModel({
      transactions: [{
        id: "negative-adjustment",
        transactionDate: "2026-08-05T00:00:00.000+09:00",
        type: "ADJUSTMENT",
        status: "CONFIRMED",
        originalAmount: -100,
        originalCurrency: "KRW",
        baseAmount: -100,
      }],
    }));

    expect(result.transactions).toEqual([expect.objectContaining({ original_amount: -100, base_amount: -100 })]);
  });

  it("rejects negative amounts for transaction types other than adjustments", () => {
    expect(() => generateAnalysisJson(readModel({
      transactions: [{
        id: "negative-expense",
        transactionDate: "2026-08-05T00:00:00.000+09:00",
        type: "EXPENSE",
        status: "CONFIRMED",
        baseAmount: -100,
      }],
    }))).toThrow(RangeError);
  });

  it("includes only planned future cashflows", () => {
    const result = generateAnalysisJson(readModel({
      plannedCashflows: [
        { scheduledDate: "2026-08-10", type: "EXPENSE", status: "PLANNED", baseAmount: 10_000 },
        { scheduledDate: "2026-08-11", type: "EXPENSE", status: "CONFIRMED", baseAmount: 20_000 },
        { scheduledDate: "2026-08-12", type: "INCOME", status: "CANCELLED", baseAmount: 30_000 },
      ],
    }));

    expect(result.planned_cashflows).toEqual([expect.objectContaining({ scheduled_date: "2026-08-10", status: "PLANNED" })]);
  });

  it("whitelists analysis fields and does not expose secret-like source properties", () => {
    const result = generateAnalysisJson({
      ...readModel(),
      api_key: "not-for-export",
      oauth_access_token: "not-for-export",
      invite_code: "not-for-export",
    } as ExportReadModel);

    expect(JSON.stringify(result)).not.toContain("not-for-export");
  });
});
