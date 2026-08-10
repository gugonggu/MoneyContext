import { expect, it } from "vitest";
import { calculateActualBudgetUsage, calculateForecastBudgetUsage, calculateRollover } from "@/domain/budgets/usage";
import { calculateFreeSpendable } from "@/domain/forecasts/spendable";
import { calculateRemainingSavings, calculateRequiredMonthlySavings } from "@/domain/savings/projection";

it("keeps pending expense out of actual budget usage", () => expect(calculateActualBudgetUsage([{ amount: 300_000, status: "CONFIRMED" }, { amount: 200_000, status: "PENDING" }])).toBe(300_000));
it("carries positive and negative budget rollover", () => { expect(calculateRollover(100_000, 70_000)).toBe(30_000); expect(calculateRollover(100_000, 120_000)).toBe(-20_000); });
it("adds planned expenses only to forecast", () => expect(calculateForecastBudgetUsage(300_000, [200_000])).toBe(500_000));
it("projects required savings", () => { expect(calculateRemainingSavings(1_500_000, 500_000)).toBe(1_000_000); expect(calculateRequiredMonthlySavings(1_000_000, 5)).toBe(200_000); });
it("deduplicates forecast deductions by provenance", () => expect(calculateFreeSpendable(1_500_000, [{ amount: 300_000, provenance: "card" }, { amount: 300_000, provenance: "card" }, { amount: 200_000, provenance: "planned" }])).toBe(1_000_000));
