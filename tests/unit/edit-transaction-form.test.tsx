import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditTransactionForm } from "@/components/transactions/EditTransactionForm";

afterEach(cleanup);

const accounts = [
  { id: "bank-a", name: "주거래 은행", type: "BANK" as const },
  { id: "bank-b", name: "저축 은행", type: "BANK" as const },
];
const categories = [{ id: "cat-food", name: "식비", kind: "EXPENSE" as const }];

const expenseTransaction = {
  id: "txn-1",
  type: "EXPENSE" as const,
  amount: 12_000,
  currency: "KRW",
  accountId: "bank-a",
  categoryId: "cat-food",
  memo: "점심",
  transactionAtLocal: "2026-08-11T13:30",
};

const transferTransaction = {
  id: "txn-2",
  type: "TRANSFER" as const,
  amount: 50_000,
  currency: "KRW",
  fromAccountId: "bank-a",
  toAccountId: "bank-b",
  memo: "",
  transactionAtLocal: "2026-08-11T13:30",
};

function renderForm(transaction = expenseTransaction, action = vi.fn(async () => ({ status: "idle" as const }))) {
  render(<EditTransactionForm transaction={transaction} accounts={accounts} categories={categories} action={action} />);
  return action;
}

describe("EditTransactionForm", () => {
  it("prefills amount, memo, category, and account from the transaction", () => {
    renderForm();

    expect((screen.getByLabelText("금액") as HTMLInputElement).value).toBe("12000");
    expect((screen.getByLabelText("메모") as HTMLInputElement).value).toBe("점심");
    expect((screen.getByLabelText("카테고리 (무엇을 샀나요)") as HTMLSelectElement).value).toBe("cat-food");
    expect((screen.getByLabelText("결제수단") as HTMLSelectElement).value).toBe("bank-a");
    expect((screen.getByLabelText("날짜/시간") as HTMLInputElement).value).toBe("2026-08-11T13:30");
  });

  it("submits an edited date and time", async () => {
    const action = vi.fn(async () => ({ status: "idle" as const }));
    renderForm(expenseTransaction, action);

    fireEvent.change(screen.getByLabelText("날짜/시간"), { target: { value: "2026-08-12T09:00" } });
    fireEvent.submit(screen.getByLabelText("날짜/시간").closest("form")!);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const submitted = action.mock.calls[0][1] as FormData;
    expect(submitted.get("transactionAt")).toBe("2026-08-12T09:00");
  });

  it("shows source/destination accounts instead of category for a TRANSFER", () => {
    renderForm(transferTransaction);

    expect(screen.getByLabelText("출금 계좌")).toBeTruthy();
    expect(screen.getByLabelText("입금 계좌")).toBeTruthy();
    expect(screen.queryByLabelText("카테고리 (무엇을 샀나요)")).toBeNull();
  });

  it("does not offer tag or installment editing", () => {
    renderForm();

    expect(screen.queryByText("태그")).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "할부로 결제" })).toBeNull();
  });

  it("preserves edited values and shows the error message when the action fails", async () => {
    const action = vi.fn(async () => ({ status: "error" as const, message: "수정에 실패했습니다" }));
    renderForm(expenseTransaction, action);

    const memoInput = screen.getByLabelText("메모") as HTMLInputElement;
    fireEvent.change(memoInput, { target: { value: "저녁" } });

    const form = memoInput.closest("form");
    if (!form) throw new Error("form not found");
    fireEvent.submit(form);

    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByRole("alert").textContent).toContain("수정에 실패했습니다");
    expect((screen.getByLabelText("메모") as HTMLInputElement).value).toBe("저녁");
  });
});
