import { describe, expect, it } from "vitest";
import { buildRecentDashboardDays, createDashboardService } from "@/server/dashboard/service";
describe("dashboard service", () => {
  it("prioritizes spendable amounts and summarizes current-cycle income and expense", async () => {
    const service = createDashboardService({ getData: async () => ({ freeSpendable: 450_000, dailySpendable: 50_000, liquidAssets: 1_000_000, netWorth: 700_000, cardOutstanding: 100_000, income: 3_000_000, expense: 800_000, budgetUsage: 800_000, savingsGoals: 2, upcomingEvents: 3, recentDays: [] }) });
    await expect(service.getOverview("user-a")).resolves.toMatchObject({ freeSpendable: 450_000, dailySpendable: 50_000, income: 3_000_000, expense: 800_000, cardOutstanding: 100_000 });
  });

  it("builds fourteen Seoul calendar days ending today from confirmed real transactions", () => {
    const days = buildRecentDashboardDays("2026-08-13", [
      { id: "income", type: "INCOME", status: "CONFIRMED", transactionAt: "2026-08-12T23:30:00Z", baseAmount: 2_500_000 },
      { id: "expense", type: "EXPENSE", status: "CONFIRMED", transactionAt: "2026-08-12T00:00:00+09:00", baseAmount: 47_000 },
      { id: "transfer", type: "TRANSFER", status: "CONFIRMED", transactionAt: "2026-08-12T12:00:00+09:00", baseAmount: 900_000 },
      { id: "adjustment", type: "ADJUSTMENT", status: "CONFIRMED", transactionAt: "2026-08-12T12:00:00+09:00", baseAmount: 300_000 },
      { id: "pending", type: "EXPENSE", status: "PENDING", transactionAt: "2026-08-13T12:00:00+09:00", baseAmount: 70_000 },
      { id: "cancelled", type: "EXPENSE", status: "CANCELLED", transactionAt: "2026-08-13T12:00:00+09:00", baseAmount: 80_000 },
      { id: "old", type: "EXPENSE", status: "CONFIRMED", transactionAt: "2026-07-30T12:00:00+09:00", baseAmount: 99_000 },
    ]);

    expect(days).toHaveLength(14);
    expect(days[0]?.date).toBe("2026-07-31");
    expect(days[13]?.date).toBe("2026-08-13");
    expect(days.find((day) => day.date === "2026-08-12")).toMatchObject({
      income: 0,
      expense: 47_000,
      heatLevel: 4,
    });
    expect(days.find((day) => day.date === "2026-08-13")).toMatchObject({ income: 2_500_000, expense: 0, heatLevel: 0 });
  });
});
