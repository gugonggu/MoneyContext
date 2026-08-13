import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AddAccountForm } from "@/components/assets/AddAccountForm";

afterEach(cleanup);

const BANK_ACCOUNTS = [
  { id: "bank-a", name: "Main bank" },
  { id: "bank-b", name: "Savings bank" },
];

describe("AddAccountForm", () => {
  it("only asks for a name and balance for a plain account by default", () => {
    render(<AddAccountForm bankAccounts={BANK_ACCOUNTS} action={async () => ({ status: "idle" })} />);

    expect(screen.getByLabelText("이름")).toBeTruthy();
    expect(screen.getByLabelText("현재 잔액")).toBeTruthy();
    expect(screen.queryByLabelText("연결할 은행 계좌")).toBeNull();
    expect(screen.queryByLabelText("결제 계좌")).toBeNull();
  });

  it("asks for a linked bank account instead of a balance when 체크카드 is selected", () => {
    render(<AddAccountForm bankAccounts={BANK_ACCOUNTS} action={async () => ({ status: "idle" })} />);

    fireEvent.change(screen.getByLabelText("종류"), { target: { value: "DEBIT" } });

    expect(screen.queryByLabelText("현재 잔액")).toBeNull();
    const linkSelect = screen.getByLabelText("연결할 은행 계좌") as HTMLSelectElement;
    expect(Array.from(linkSelect.options).map((option) => option.value)).toEqual(expect.arrayContaining(["bank-a", "bank-b"]));
  });

  it("asks for payment account, payment day, and optional limit when 신용카드 is selected", () => {
    render(<AddAccountForm bankAccounts={BANK_ACCOUNTS} action={async () => ({ status: "idle" })} />);

    fireEvent.change(screen.getByLabelText("종류"), { target: { value: "CREDIT_CARD" } });

    expect(screen.getByLabelText("결제 계좌")).toBeTruthy();
    expect(screen.getByLabelText(/^결제일/)).toBeTruthy();
    expect(screen.getByLabelText("한도 (선택)")).toBeTruthy();
    expect(screen.getByLabelText(/^첫 결제일/)).toBeTruthy();
  });

  it("disables submit for account types that need a bank account when none exists yet", () => {
    render(<AddAccountForm bankAccounts={[]} action={async () => ({ status: "idle" })} />);

    fireEvent.change(screen.getByLabelText("종류"), { target: { value: "DEBIT" } });

    expect((screen.getByRole("button", { name: "추가" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("submits the selected fields and reports an accessible error on failure", async () => {
    const action = vi.fn(async () => ({ status: "error" as const, message: "이름을 입력해주세요" }));
    render(<AddAccountForm bankAccounts={BANK_ACCOUNTS} action={action} />);

    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "새 통장" } });
    fireEvent.change(screen.getByLabelText("현재 잔액"), { target: { value: "50000" } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const submitted = action.mock.calls[0][1] as FormData;
    expect(submitted.get("name")).toBe("새 통장");
    expect(submitted.get("initialBalance")).toBe("50000");
    expect(submitted.get("type")).toBe("BANK");

    expect((await screen.findByRole("alert")).textContent).toContain("이름을 입력해주세요");
  });

  it("shows a success message after adding an account", async () => {
    render(<AddAccountForm bankAccounts={BANK_ACCOUNTS} action={async () => ({ status: "success" })} />);

    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "현금" } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect((await screen.findByRole("status")).textContent).toContain("추가했습니다");
  });
});
