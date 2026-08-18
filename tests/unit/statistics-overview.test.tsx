import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatisticsOverview } from "@/components/statistics/StatisticsOverview";

describe("StatisticsOverview", () => {
  it("preserves a negative savings rate instead of presenting it as zero", () => {
    render(
      <StatisticsOverview
        statistics={{
          monthly: [{ key: "2026-08", income: 100_000, expense: 120_000, value: -20_000 }],
          category: [],
          tags: [],
          paymentMethods: [],
          fixedVariable: [],
          weekday: [],
          weekOfMonth: [],
          monthOverMonth: 20,
          savingsRate: -20,
          netWorthTrend: [],
          spendComposition: {
            totalExpenseBaseAmount: 120_000,
            exceptionalBaseAmount: 0,
            oneTimeBaseAmount: 0,
            habitualBaseAmount: 120_000,
            adjustedExpenseBaseAmount: 120_000,
            natureBreakdown: { RECURRING: 120_000, ONE_TIME: 0, IRREGULAR: 0, EXCEPTIONAL: 0, UNKNOWN: 0 },
          },
          concentration: {
            top1Share: 1,
            top3Share: 1,
            top5Share: 1,
            topTransactionIds: ["0"],
            topTransactions: [{ label: "미분류", baseAmount: 120_000 }],
          },
        }}
      />,
    );

    expect(screen.getByText("-20%")).toBeTruthy();
    expect(screen.queryByRole("img", { name: /저축률 0%/ })).toBeNull();
  });
});
