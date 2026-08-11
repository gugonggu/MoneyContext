import { describe, expect, it } from "vitest";

import { createPlanningReadService } from "@/server/planning/read-service";

describe("planning read service", () => {
  it("keeps actual and planned budget usage separate while deriving savings and free spendable", async () => {
    const service = createPlanningReadService({
      getData: async () => ({
        liquidAssets: 500_000,
        expenses: [{ amount: 80_000, status: "CONFIRMED" as const }],
        plannedExpenses: [30_000],
        goals: [{ id: "goal-a", name: "Emergency fund", targetAmount: 1_000_000, monthlyContributionPlan: 100_000 }],
        contributions: [{ goalId: "goal-a", amount: 300_000 }],
        deductions: [{ amount: 50_000, provenance: "card-a" }, { amount: 50_000, provenance: "card-a" }],
      }),
    });

    await expect(service.getOverview("user-a")).resolves.toMatchObject({
      budget: { actualUsage: 80_000, forecastUsage: 110_000 },
      goals: [{ id: "goal-a", contributedAmount: 300_000, remainingAmount: 700_000, requiredMonthlyAmount: 700_000 }],
      freeSpendable: 450_000,
    });
  });
});
