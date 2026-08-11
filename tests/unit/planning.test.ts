import { expect, it } from "vitest";
import { calculateActualBudgetUsage, calculateForecastBudgetUsage, calculateRollover } from "@/domain/budgets/usage";
import { aggregateRequiredCashflow, calculateFreeSpendable } from "@/domain/forecasts/spendable";
import { calculateRemainingSavings, calculateRequiredMonthlySavings, projectSavingsGoal } from "@/domain/savings/projection";

it("keeps pending expense out of actual budget usage", () => expect(calculateActualBudgetUsage([{ amount: 300_000, status: "CONFIRMED" }, { amount: 200_000, status: "PENDING" }])).toBe(300_000));
it("carries positive and negative budget rollover", () => { expect(calculateRollover(100_000, 70_000)).toBe(30_000); expect(calculateRollover(100_000, 120_000)).toBe(-20_000); });
it("adds planned expenses only to forecast", () => expect(calculateForecastBudgetUsage(300_000, [200_000])).toBe(500_000));
it("projects required savings", () => { expect(calculateRemainingSavings(1_500_000, 500_000)).toBe(1_000_000); expect(calculateRequiredMonthlySavings(1_000_000, 5)).toBe(200_000); });
it("classifies savings goals by achieved, on-track, at-risk, and overdue status", () => {
  expect(projectSavingsGoal({ targetAmount: 1_000, contributedAmount: 1_000, targetDate: "2026-12-31", monthlyContributionPlan: 0, today: "2026-08-11" }).status).toBe("ACHIEVED");
  expect(projectSavingsGoal({ targetAmount: 1_000, contributedAmount: 500, targetDate: "2026-12-31", monthlyContributionPlan: 100, today: "2026-08-11" })).toMatchObject({ remainingContributions: 4, requiredMonthlyAmount: 125, status: "AT_RISK" });
  expect(projectSavingsGoal({ targetAmount: 1_000, contributedAmount: 500, targetDate: "2026-12-31", monthlyContributionPlan: 125, today: "2026-08-11" }).status).toBe("ON_TRACK");
  expect(projectSavingsGoal({ targetAmount: 1_000, contributedAmount: 500, targetDate: "2026-08-01", monthlyContributionPlan: 1_000, today: "2026-08-11" }).status).toBe("OVERDUE");
});
it("deduplicates forecast deductions by provenance", () => expect(calculateFreeSpendable(1_500_000, [{ amount: 300_000, provenance: "card" }, { amount: 300_000, provenance: "card" }, { amount: 200_000, provenance: "planned" }])).toBe(1_000_000));
it("aggregates planned, recurring, card, and savings cashflow without duplicate card deductions", () => {
  expect(aggregateRequiredCashflow([
    { amount: 200_000, provenance: "planned:rent" }, { amount: 50_000, provenance: "recurring:phone" },
    { amount: 300_000, provenance: "card:card-a" }, { amount: 300_000, provenance: "card:card-a" },
    { amount: 100_000, provenance: "savings:goal-a" },
  ])).toBe(650_000);
});
