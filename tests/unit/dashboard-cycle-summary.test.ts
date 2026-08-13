import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireCurrentProfile = vi.fn();
const getAssetOverviewForCurrentUser = vi.fn();
const getPlanningOverviewForCurrentUser = vi.fn();
const listTransactionsForCurrentUser = vi.fn();

vi.mock("@/server/auth/require-profile", () => ({ requireCurrentProfile }));
vi.mock("@/server/assets", () => ({ getAssetOverviewForCurrentUser }));
vi.mock("@/server/planning", () => ({ getPlanningOverviewForCurrentUser }));
vi.mock("@/server/transactions", () => ({ listTransactionsForCurrentUser }));

const { getDashboardOverviewForCurrentUser } = await import("@/server/dashboard");

function transaction(overrides: Record<string, unknown>) {
  return {
    id: overrides.id,
    type: overrides.type,
    status: overrides.status,
    transactionAt: overrides.transactionAt,
    baseAmount: overrides.baseAmount,
  };
}

describe("getDashboardOverviewForCurrentUser — current salary-cycle summary", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-08-13T03:00:00Z"));
    requireCurrentProfile.mockResolvedValue({ id: "user-a", salary_cycle_day: 25 });
    getAssetOverviewForCurrentUser.mockResolvedValue({ liquidAssets: 0, netWorth: 0, cards: [] });
    getPlanningOverviewForCurrentUser.mockResolvedValue({
      freeSpendable: 100_000,
      budget: { actualUsage: 0 },
      goals: [],
      futureCashflowCount: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("counts only CONFIRMED transactions within the cycle toward income and expense", async () => {
    listTransactionsForCurrentUser.mockResolvedValue([
      transaction({ id: "confirmed-in-cycle-income", type: "INCOME", status: "CONFIRMED", transactionAt: "2026-08-01T00:00:00+09:00", baseAmount: 3_000_000 }),
      transaction({ id: "confirmed-in-cycle-expense", type: "EXPENSE", status: "CONFIRMED", transactionAt: "2026-08-05T00:00:00+09:00", baseAmount: 47_000 }),
      transaction({ id: "pending-in-cycle", type: "EXPENSE", status: "PENDING", transactionAt: "2026-08-05T00:00:00+09:00", baseAmount: 70_000 }),
      transaction({ id: "cancelled-in-cycle", type: "EXPENSE", status: "CANCELLED", transactionAt: "2026-08-05T00:00:00+09:00", baseAmount: 80_000 }),
      transaction({ id: "confirmed-before-cycle", type: "EXPENSE", status: "CONFIRMED", transactionAt: "2026-07-20T00:00:00+09:00", baseAmount: 99_000 }),
    ]);

    const overview = await getDashboardOverviewForCurrentUser();

    expect(overview.income).toBe(3_000_000);
    expect(overview.expense).toBe(47_000);
  });

  it("excludes CONFIRMED transactions that fall outside the current cycle window", async () => {
    listTransactionsForCurrentUser.mockResolvedValue([
      transaction({ id: "previous-cycle", type: "EXPENSE", status: "CONFIRMED", transactionAt: "2026-07-24T00:00:00+09:00", baseAmount: 500_000 }),
      transaction({ id: "current-cycle", type: "EXPENSE", status: "CONFIRMED", transactionAt: "2026-07-25T00:00:00+09:00", baseAmount: 1_000 }),
    ]);

    const overview = await getDashboardOverviewForCurrentUser();

    expect(overview.expense).toBe(1_000);
  });
});
