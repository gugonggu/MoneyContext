import { describe, expect, it } from "vitest";

import { buildNotificationCandidates, type NotificationRuleInput } from "@/domain/notifications/rules";

const today = "2026-08-11";

function input(overrides: Partial<NotificationRuleInput> = {}): NotificationRuleInput {
  return {
    today,
    pendingRecurringTransactions: [],
    plannedTransactions: [],
    cardPayments: [],
    monthlyBudgets: [],
    transactions: [],
    savingsGoals: [],
    ...overrides,
  };
}

describe("notification candidate rules", () => {
  it("notifies for each pending recurring confirmation with a stable occurrence-date key", () => {
    const ruleInput = input({
      pendingRecurringTransactions: [{ id: "recurring-transaction-1", occurrenceDate: today }],
    });

    const candidates = buildNotificationCandidates(ruleInput);

    expect(candidates).toContainEqual(expect.objectContaining({
      type: "RECURRING_CONFIRMATION",
      relatedEntityType: "transaction",
      relatedEntityId: "recurring-transaction-1",
      dedupeKey: "recurring-confirmation:recurring-transaction-1:2026-08-11",
    }));
  });

  it("notifies only planned rows that are due today or overdue", () => {
    const candidates = buildNotificationCandidates(input({
      plannedTransactions: [
        { id: "overdue", scheduledDate: "2026-08-10", baseAmount: 50_000 },
        { id: "today", scheduledDate: today, baseAmount: 60_000 },
        { id: "future", scheduledDate: "2026-08-12", baseAmount: 70_000 },
      ],
    }));

    expect(candidates.filter((candidate) => candidate.type === "PLANNED_DUE").map((candidate) => candidate.relatedEntityId))
      .toEqual(["overdue", "today"]);
    expect(candidates.map((candidate) => candidate.dedupeKey)).toContain("planned-due:overdue:2026-08-10");
  });

  it("notifies card payments due from today through three Seoul calendar days away", () => {
    const candidates = buildNotificationCandidates(input({
      cardPayments: [
        { accountId: "card-today", dueDate: "2026-08-11" },
        { accountId: "card-three-days", dueDate: "2026-08-14" },
        { accountId: "card-four-days", dueDate: "2026-08-15" },
      ],
    }));

    expect(candidates.filter((candidate) => candidate.type === "CARD_PAYMENT_DUE").map((candidate) => candidate.relatedEntityId))
      .toEqual(["card-today", "card-three-days"]);
    expect(candidates.map((candidate) => candidate.dedupeKey)).toContain("card-payment-due:card-three-days:2026-08-14");
  });

  it("emits each crossed 80, 90, and 100 percent budget threshold from confirmed expense base amounts only", () => {
    const candidates = buildNotificationCandidates(input({
      monthlyBudgets: [{ id: "budget-1", baseAmount: 100_000 }],
      transactions: [
        { type: "EXPENSE", status: "CONFIRMED", transactionDate: today, baseAmount: 80_000 },
        { type: "TRANSFER", status: "CONFIRMED", transactionDate: today, baseAmount: 50_000 },
        { type: "ADJUSTMENT", status: "CONFIRMED", transactionDate: today, baseAmount: 50_000 },
        { type: "EXPENSE", status: "PENDING", transactionDate: today, baseAmount: 50_000 },
      ],
    }));

    expect(candidates.filter((candidate) => candidate.type === "BUDGET_THRESHOLD").map((candidate) => candidate.dedupeKey))
      .toEqual(["budget-threshold:budget-1:2026-08:80"]);
  });

  it.each([
    [80_000, [80]],
    [90_000, [80, 90]],
    [100_000, [80, 90, 100]],
  ])("emits boundaries through %i percent", (expenseBaseAmount, thresholds) => {
    const candidates = buildNotificationCandidates(input({
      monthlyBudgets: [{ id: "budget-1", baseAmount: 100_000 }],
      transactions: [{ type: "EXPENSE", status: "CONFIRMED", transactionDate: today, baseAmount: expenseBaseAmount }],
    }));

    expect(candidates.filter((candidate) => candidate.type === "BUDGET_THRESHOLD").map((candidate) => candidate.dedupeKey))
      .toEqual(thresholds.map((threshold) => `budget-threshold:budget-1:2026-08:${threshold}`));
  });

  it("notifies active savings goals that are at risk or overdue", () => {
    const candidates = buildNotificationCandidates(input({
      savingsGoals: [
        { id: "at-risk", targetAmount: 1_000_000, contributedBaseAmount: 0, targetDate: "2026-10-01", monthlyContributionPlan: 100_000, isActive: true },
        { id: "overdue", targetAmount: 1_000_000, contributedBaseAmount: 100_000, targetDate: "2026-08-10", monthlyContributionPlan: 1_000_000, isActive: true },
        { id: "on-track", targetAmount: 1_000_000, contributedBaseAmount: 0, targetDate: "2026-10-01", monthlyContributionPlan: 500_000, isActive: true },
        { id: "inactive", targetAmount: 1_000_000, contributedBaseAmount: 0, targetDate: "2026-08-10", monthlyContributionPlan: 0, isActive: false },
      ],
    }));

    expect(candidates.filter((candidate) => candidate.type === "SAVINGS_RISK").map((candidate) => candidate.relatedEntityId))
      .toEqual(["at-risk", "overdue"]);
    expect(candidates.map((candidate) => candidate.dedupeKey)).toContain("savings-risk:overdue:OVERDUE:2026-08-10");
  });

  it("generates identical dedupe keys for a second run with the same data", () => {
    const ruleInput = input({
      plannedTransactions: [{ id: "planned-1", scheduledDate: today, baseAmount: 50_000 }],
      cardPayments: [{ accountId: "card-1", dueDate: "2026-08-12" }],
    });

    expect(buildNotificationCandidates(ruleInput).map((candidate) => candidate.dedupeKey))
      .toEqual(buildNotificationCandidates(ruleInput).map((candidate) => candidate.dedupeKey));
  });
});
