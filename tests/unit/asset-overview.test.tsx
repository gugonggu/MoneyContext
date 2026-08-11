import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssetOverview } from "@/components/assets/AssetOverview";

afterEach(cleanup);

const overview = {
  liquidAssets: 1_000_000,
  liabilities: 200_000,
  netWorth: 700_000,
  accounts: {
    bank: [{ id: "bank-a", name: "Main bank", type: "BANK" as const, balance: 1_000_000, linkedAccountId: null }],
    cash: [], debit: [], liability: [{ id: "loan-a", name: "Loan", type: "LIABILITY" as const, balance: 200_000, linkedAccountId: null }],
  },
  cards: [{ id: "card-a", name: "Card", outstanding: 100_000, availableLimit: 900_000, nextPaymentDate: "2026-09-10", installmentSchedule: [{ id: "installment-a", sequence: 1, scheduledDate: "2026-09-10", principalAmount: 50_000, feeAmount: 0, status: "SCHEDULED" as const }] }],
};

describe("AssetOverview", () => {
  it("renders account groups and card outstanding with its upcoming installment", () => {
    render(<AssetOverview overview={overview} action={async () => ({ status: "idle" })} />);

    expect(screen.getByText("Main bank")).toBeTruthy();
    expect(screen.getByText("Card")).toBeTruthy();
    expect(screen.getByText(/Next payment: 2026-09-10/)).toBeTruthy();
    expect(screen.getByText(/2026-09-10.*50,000/)).toBeTruthy();
    expect(screen.getByText("1,000,000")).toBeTruthy();
  });

  it("submits a reconciliation balance and preserves it when the action fails", async () => {
    const action = vi.fn(async () => ({ status: "error" as const, message: "Unable to reconcile" }));
    render(<AssetOverview overview={overview} action={action} />);

    fireEvent.change(screen.getByLabelText("Actual balance for Main bank"), { target: { value: "950000" } });
    fireEvent.submit(screen.getByLabelText("Reconcile Main bank").closest("form")!);

    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByRole("alert").textContent).toContain("Unable to reconcile");
    expect((screen.getByLabelText("Actual balance for Main bank") as HTMLInputElement).value).toBe("950000");
  });
});
