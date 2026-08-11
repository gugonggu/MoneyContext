import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlanningOverview } from "@/components/planning/PlanningOverview";

describe("PlanningOverview", () => {
  it("renders budget, free spendable amount, and savings goal projections", () => {
    render(<PlanningOverview overview={{ budget: { actualUsage: 80_000, forecastUsage: 110_000 }, freeSpendable: 450_000, goals: [{ id: "goal-a", name: "Emergency fund", contributedAmount: 300_000, remainingAmount: 700_000, requiredMonthlyAmount: 175_000 }] }} />);
    expect(screen.getByText(/450,000/)).toBeTruthy();
    expect(screen.getByText("Emergency fund")).toBeTruthy();
    expect(screen.getByText(/110,000/)).toBeTruthy();
  });
});
