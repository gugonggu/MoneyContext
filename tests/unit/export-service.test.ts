import { describe, expect, it, vi } from "vitest";

import { createExportService, type ExportReadRepository } from "@/server/export/service";

const repositoryData = {
  baseCurrency: "KRW",
  financialPosition: { totalAssets: 1_000_000, totalLiabilities: 0, creditCardOutstanding: 0, netWorth: 1_000_000 },
  transactions: [],
  budgets: [],
  plannedCashflows: [],
  savingsGoals: [],
  creditCards: [],
} as const;

describe("createExportService", () => {
  it("builds an export only for the authenticated profile user id", async () => {
    const getReadData = vi.fn().mockResolvedValue(repositoryData);
    const format = vi.fn().mockReturnValue("# Export");
    const repository: ExportReadRepository = { getReadData };

    const markdown = await createExportService(repository, format).generateMarkdown("user-a", {
      preset: "SPENDING_REVIEW",
      period: { kind: "CUSTOM", startDate: "2026-08-01", endDate: "2026-08-31" },
    }, new Date("2026-08-11T09:00:00+09:00"));

    expect(markdown).toBe("# Export");
    expect(getReadData).toHaveBeenCalledWith("user-a", { startDate: "2026-08-01", endDate: "2026-08-31" });
    expect(format).toHaveBeenCalledWith(expect.objectContaining({
      baseCurrency: "KRW",
      preset: "SPENDING_REVIEW",
      period: { startDate: "2026-08-01", endDate: "2026-08-31" },
    }));
  });

  it("rejects an invalid range before reading data or invoking the formatter", async () => {
    const getReadData = vi.fn().mockResolvedValue(repositoryData);
    const format = vi.fn().mockReturnValue("# Export");
    const repository: ExportReadRepository = { getReadData };

    await expect(createExportService(repository, format).generateMarkdown("user-a", {
      preset: "SPENDING_REVIEW",
      period: { kind: "CUSTOM", startDate: "2026-08-31", endDate: "2026-08-01" },
    })).rejects.toThrow(RangeError);

    expect(getReadData).not.toHaveBeenCalled();
    expect(format).not.toHaveBeenCalled();
  });
});
