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
  cards: [{ id: "card-a", name: "Card", outstanding: 100_000, availableLimit: 900_000, nextPaymentDate: "2026-09-10", installmentSchedule: [{ id: "installment-a", sequence: 1, scheduledDate: "2026-09-10", principalAmount: 50_000, feeAmount: 0, paymentAmount: 60_000, status: "SCHEDULED" as const }] }],
};

describe("AssetOverview", () => {
  it("renders account groups and card outstanding with its upcoming installment", () => {
    render(<AssetOverview overview={overview} action={async () => ({ status: "idle" })} />);

    expect(screen.getByText("Main bank")).toBeTruthy();
    expect(screen.getByText("Card")).toBeTruthy();
    expect(screen.getByText(/다음 결제일 2026-09-10/)).toBeTruthy();
    expect(screen.getByText(/2026-09-10.*60,000/)).toBeTruthy();
    expect(screen.getAllByText(/1,000,000/).length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: "한도 사용률 10%" })).toBeTruthy();
    expect(screen.getByText("남은 한도 900,000원")).toBeTruthy();
  });

  it("submits a reconciliation balance and preserves it when the action fails", async () => {
    const action = vi.fn(async () => ({ status: "error" as const, message: "잔액 조정에 실패했습니다" }));
    render(<AssetOverview overview={overview} action={action} />);

    fireEvent.change(screen.getByLabelText("Main bank 실제 잔액"), { target: { value: "950000" } });
    fireEvent.submit(screen.getByLabelText("Main bank 잔액 조정").closest("form")!);

    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByRole("alert").textContent).toContain("잔액 조정에 실패했습니다");
    expect((screen.getByLabelText("Main bank 실제 잔액") as HTMLInputElement).value).toBe("950000");
  });

  it("does not render a usage ring when the card limit is unknown", () => {
    render(
      <AssetOverview
        overview={{ ...overview, cards: [{ ...overview.cards[0], availableLimit: null }] }}
        action={async () => ({ status: "idle" })}
      />,
    );

    expect(screen.queryByRole("img", { name: /한도 사용률/ })).toBeNull();
  });
});
