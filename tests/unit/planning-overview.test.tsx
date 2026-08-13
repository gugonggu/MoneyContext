import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlanningOverview } from "@/components/planning/PlanningOverview";

describe("PlanningOverview", () => {
  it("switches between budget, savings, and future cashflow sections", () => {
    render(
      <PlanningOverview
        overview={{ budget: { actualUsage: 80_000, forecastUsage: 110_000 }, freeSpendable: 450_000, futureCashflowCount: 2, goals: [{ id: "goal-a", name: "Emergency fund", contributedAmount: 300_000, remainingAmount: 700_000, requiredMonthlyAmount: 175_000 }] }}
        budgetForms={<p>예산 폼</p>}
        savingsForms={<p>저축 폼</p>}
      />,
    );

    expect(screen.getByText(/110,000/)).toBeTruthy();
    expect(screen.getByText("예산 폼")).toBeTruthy();
    expect(screen.queryByText("Emergency fund")).toBeNull();
    expect(screen.queryByText("저축 폼")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "저축 목표" }));
    expect(screen.getByText("Emergency fund")).toBeTruthy();
    expect(screen.getByText("저축 폼")).toBeTruthy();
    expect(screen.queryByText("예산 폼")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "미래 현금흐름" }));
    expect(screen.getByText(/450,000/)).toBeTruthy();
    expect(screen.getByText("예정된 현금흐름 2건")).toBeTruthy();
  });
});
