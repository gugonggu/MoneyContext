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
        }}
      />,
    );

    expect(screen.getByText("-20%")).toBeTruthy();
    expect(screen.queryByRole("img", { name: /저축률 0%/ })).toBeNull();
  });
});
