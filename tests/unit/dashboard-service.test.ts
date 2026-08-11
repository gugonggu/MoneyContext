import { describe, expect, it } from "vitest";
import { createDashboardService } from "@/server/dashboard/service";
describe("dashboard service", () => {
  it("prioritizes spendable amounts and summarizes current-cycle income and expense", async () => {
    const service = createDashboardService({ getData: async () => ({ freeSpendable: 450_000, dailySpendable: 50_000, liquidAssets: 1_000_000, netWorth: 700_000, cardOutstanding: 100_000, income: 3_000_000, expense: 800_000, budgetUsage: 800_000, savingsGoals: 2, upcomingEvents: 3 }) });
    await expect(service.getOverview("user-a")).resolves.toMatchObject({ freeSpendable: 450_000, dailySpendable: 50_000, income: 3_000_000, expense: 800_000, cardOutstanding: 100_000 });
  });
});
