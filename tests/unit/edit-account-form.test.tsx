import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AccountRow } from "@/components/assets/AccountRow";
import { EditAccountForm } from "@/components/assets/EditAccountForm";

afterEach(cleanup);

const BANK_ACCOUNTS = [{ id: "bank-a", name: "Main bank" }];

describe("EditAccountForm", () => {
  it("asks for a name and a direct balance change when the account is not a 체크카드", () => {
    render(
      <EditAccountForm
        account={{ id: "loan-a", name: "Loan", type: "LIABILITY", linkedAccountId: null, balance: 200_000 }}
        bankAccounts={BANK_ACCOUNTS}
        action={async () => ({ status: "idle" })}
      />,
    );

    expect(screen.getByLabelText("이름")).toBeTruthy();
    expect(screen.queryByLabelText("연결할 은행 계좌")).toBeNull();
    expect((screen.getByLabelText(/^잔액 직접 변경/) as HTMLInputElement).value).toBe("200000");
  });

  it("prefills the linked bank account for a 체크카드, with no balance field", () => {
    render(
      <EditAccountForm
        account={{ id: "debit-a", name: "체크카드", type: "DEBIT", linkedAccountId: "bank-a", balance: 0 }}
        bankAccounts={BANK_ACCOUNTS}
        action={async () => ({ status: "idle" })}
      />,
    );

    expect((screen.getByLabelText("연결할 은행 계좌") as HTMLSelectElement).value).toBe("bank-a");
    expect(screen.queryByLabelText(/잔액/)).toBeNull();
  });

  it("submits the account id, new name, and the edited balance", async () => {
    const action = vi.fn(async () => ({ status: "success" as const }));
    render(
      <EditAccountForm
        account={{ id: "loan-a", name: "Loan", type: "LIABILITY", linkedAccountId: null, balance: 200_000 }}
        bankAccounts={BANK_ACCOUNTS}
        action={action}
      />,
    );

    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "새 이름" } });
    fireEvent.change(screen.getByLabelText(/^잔액 직접 변경/), { target: { value: "250000" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const submitted = action.mock.calls[0][1] as FormData;
    expect(submitted.get("accountId")).toBe("loan-a");
    expect(submitted.get("name")).toBe("새 이름");
    expect(submitted.get("balance")).toBe("250000");

    expect((await screen.findByRole("status")).textContent).toContain("저장했습니다");
  });
});

describe("AccountRow", () => {
  it("toggles the edit form open and closed", () => {
    render(
      <AccountRow
        account={{ id: "bank-a", name: "Main bank", type: "BANK", balance: 1_000, linkedAccountId: null }}
        bankAccounts={BANK_ACCOUNTS}
        reconcileAction={async () => ({ status: "idle" })}
        editAction={async () => ({ status: "idle" })}
      />,
    );

    expect(screen.queryByLabelText("이름")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    expect(screen.getByLabelText("이름")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByLabelText("이름")).toBeNull();
  });
});
