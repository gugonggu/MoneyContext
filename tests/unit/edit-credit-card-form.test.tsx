import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreditCardRow } from "@/components/assets/CreditCardRow";
import { EditCreditCardForm } from "@/components/assets/EditCreditCardForm";

afterEach(cleanup);

const BANK_ACCOUNTS = [
  { id: "bank-a", name: "Main bank" },
  { id: "bank-b", name: "Savings bank" },
];

describe("EditCreditCardForm", () => {
  it("prefills payment account, payment day, and limit; never shows a balance field", () => {
    render(
      <EditCreditCardForm
        card={{ id: "card-a", name: "국민카드", paymentAccountId: "bank-a", paymentDay: 25, creditLimit: 1_000_000, firstPaymentDate: null }}
        bankAccounts={BANK_ACCOUNTS}
        action={async () => ({ status: "idle" })}
      />,
    );

    expect((screen.getByLabelText("결제 계좌") as HTMLSelectElement).value).toBe("bank-a");
    expect((screen.getByLabelText(/^결제일/) as HTMLInputElement).value).toBe("25");
    expect((screen.getByLabelText("한도 (선택)") as HTMLInputElement).value).toBe("1000000");
    expect(screen.queryByLabelText(/잔액/)).toBeNull();
  });

  it("submits the account id, name, payment account, payment day, and limit", async () => {
    const action = vi.fn(async () => ({ status: "success" as const }));
    render(
      <EditCreditCardForm
        card={{ id: "card-a", name: "국민카드", paymentAccountId: "bank-a", paymentDay: 25, creditLimit: 1_000_000, firstPaymentDate: null }}
        bankAccounts={BANK_ACCOUNTS}
        action={action}
      />,
    );

    fireEvent.change(screen.getByLabelText("카드 이름"), { target: { value: "새 카드 이름" } });
    fireEvent.change(screen.getByLabelText("결제 계좌"), { target: { value: "bank-b" } });
    fireEvent.change(screen.getByLabelText(/^결제일/), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const submitted = action.mock.calls[0][1] as FormData;
    expect(submitted.get("accountId")).toBe("card-a");
    expect(submitted.get("name")).toBe("새 카드 이름");
    expect(submitted.get("paymentAccountId")).toBe("bank-b");
    expect(submitted.get("paymentDay")).toBe("10");

    expect((await screen.findByRole("status")).textContent).toContain("저장했습니다");
  });

  it("prefills and submits a first payment date for a card issued mid-cycle", async () => {
    const action = vi.fn(async () => ({ status: "success" as const }));
    render(
      <EditCreditCardForm
        card={{ id: "card-a", name: "국민카드", paymentAccountId: "bank-a", paymentDay: 14, creditLimit: null, firstPaymentDate: "2026-09-14" }}
        bankAccounts={BANK_ACCOUNTS}
        action={action}
      />,
    );

    expect((screen.getByLabelText(/^첫 결제일/) as HTMLInputElement).value).toBe("2026-09-14");

    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const submitted = action.mock.calls[0][1] as FormData;
    expect(submitted.get("firstPaymentDate")).toBe("2026-09-14");
  });
});

describe("CreditCardRow", () => {
  it("toggles the edit form open and closed", () => {
    render(
      <CreditCardRow
        card={{
          id: "card-a", name: "국민카드", outstanding: 0, availableLimit: 1_000_000, nextPaymentDate: null,
          installmentSchedule: [], paymentAccountId: "bank-a", paymentDay: 25, creditLimit: 1_000_000, firstPaymentDate: null,
        }}
        bankAccounts={BANK_ACCOUNTS}
        editAction={async () => ({ status: "idle" })}
      />,
    );

    expect(screen.queryByLabelText("결제 계좌")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    expect(screen.getByLabelText("결제 계좌")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByLabelText("결제 계좌")).toBeNull();
  });
});
