import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuickEntryForm } from "@/components/transactions/QuickEntryForm";

afterEach(cleanup);

const accounts = [
  { id: "bank-a", name: "주거래 은행", type: "BANK" as const },
  { id: "card-a", name: "신용카드", type: "CREDIT_CARD" as const },
];
const categories = [
  { id: "cat-food", name: "식비", kind: "EXPENSE" as const },
  { id: "cat-salary", name: "급여", kind: "INCOME" as const },
  { id: "cat-etc", name: "기타", kind: "BOTH" as const },
];
const tags = [{ id: "tag-work", name: "업무" }];
const today = "2026-08-11";

function renderForm(
  action = vi.fn(async () => ({ status: "idle" as const })),
  recentTransactions: Array<{ accountId: string; categoryId?: string; type: "INCOME" | "EXPENSE"; occurredAt: string }> = [],
) {
  render(
    <QuickEntryForm
      accounts={accounts}
      categories={categories}
      tags={tags}
      action={action}
      recentTransactions={recentTransactions}
      today={today}
    />,
  );
  return action;
}

describe("QuickEntryForm", () => {
  it("renders the transaction type switcher and an amount input", () => {
    renderForm();

    expect(screen.getByRole("radio", { name: "지출" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "수입" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "이체" })).toBeTruthy();
    expect(screen.getByLabelText("금액")).toBeTruthy();
  });

  it("shows category and account selectors for an EXPENSE, scoped to matching category kinds", () => {
    renderForm();

    const categorySelect = screen.getByLabelText("카테고리") as HTMLSelectElement;
    const optionNames = Array.from(categorySelect.options).map((option) => option.text);
    expect(optionNames).toContain("식비");
    expect(optionNames).toContain("기타");
    expect(optionNames).not.toContain("급여");

    expect(screen.getByLabelText("결제수단")).toBeTruthy();
  });

  it("switches to source/destination account selectors for a TRANSFER and hides the category selector", () => {
    renderForm();

    fireEvent.click(screen.getByRole("radio", { name: "이체" }));

    expect(screen.getByLabelText("출금 계좌")).toBeTruthy();
    expect(screen.getByLabelText("입금 계좌")).toBeTruthy();
    expect(screen.queryByLabelText("카테고리")).toBeNull();
  });

  it("keeps date, memo, tags, FX, and installment options collapsed until expanded", () => {
    renderForm();

    expect(screen.queryByLabelText("메모")).toBeNull();
    expect(screen.queryByLabelText("날짜/시간")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /상세 옵션/ }));

    expect(screen.getByLabelText("메모")).toBeTruthy();
    expect(screen.getByLabelText("날짜/시간")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "업무" })).toBeTruthy();
    expect(screen.getByLabelText("통화")).toBeTruthy();
  });

  it("only offers installment for EXPENSE transactions on a CREDIT_CARD account", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /상세 옵션/ }));

    expect(screen.getByRole("checkbox", { name: "할부로 결제" })).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "수입" }));
    expect(screen.queryByRole("checkbox", { name: "할부로 결제" })).toBeNull();
  });

  it("reveals the installment count field once installment is checked", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /상세 옵션/ }));

    expect(screen.queryByLabelText("할부 개월")).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "할부로 결제" }));
    expect(screen.getByLabelText("할부 개월")).toBeTruthy();
  });

  it("preserves entered values and shows the error message when the action fails", async () => {
    const action = vi.fn(async () => ({ status: "error" as const, message: "저장에 실패했습니다" }));
    renderForm(action);
    fireEvent.click(screen.getByRole("button", { name: /상세 옵션/ }));

    const memoInput = screen.getByLabelText("메모") as HTMLInputElement;
    fireEvent.change(memoInput, { target: { value: "커피" } });
    fireEvent.change(screen.getByLabelText("금액"), { target: { value: "4500" } });

    const form = memoInput.closest("form");
    if (!form) throw new Error("form not found");
    fireEvent.submit(form);

    await waitFor(() => screen.getByRole("alert"));
    expect(within(document.body).getByRole("alert").textContent).toContain("저장에 실패했습니다");
    expect((screen.getByLabelText("메모") as HTMLInputElement).value).toBe("커피");
    expect((screen.getByLabelText("금액") as HTMLInputElement).value).toBe("4500");
  });

  const recentTransactions = [
    { accountId: "bank-a", categoryId: "cat-food", type: "EXPENSE" as const, occurredAt: "2026-08-10" },
    { accountId: "bank-a", categoryId: "cat-food", type: "EXPENSE" as const, occurredAt: "2026-08-09" },
    { accountId: "card-a", categoryId: "cat-food", type: "EXPENSE" as const, occurredAt: "2026-08-05" },
  ];

  it("suggests recent accounts, frequent categories, and combos from transaction history", () => {
    renderForm(undefined, recentTransactions);

    expect(screen.getByRole("button", { name: "주거래 은행" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "식비" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "식비 · 주거래 은행" })).toBeTruthy();
  });

  it("fills the category and account fields when a combo suggestion is clicked", () => {
    renderForm(undefined, recentTransactions);

    fireEvent.click(screen.getByRole("button", { name: "식비 · 주거래 은행" }));

    expect((screen.getByLabelText("카테고리") as HTMLSelectElement).value).toBe("cat-food");
    expect((screen.getByLabelText("결제수단") as HTMLSelectElement).value).toBe("bank-a");
  });

  it("scopes suggestions to the current transaction type and hides them for TRANSFER", () => {
    renderForm(undefined, recentTransactions);

    fireEvent.click(screen.getByRole("radio", { name: "수입" }));
    expect(screen.queryByRole("button", { name: "식비" })).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "이체" }));
    expect(screen.queryByRole("button", { name: "주거래 은행" })).toBeNull();
  });

  it("shows no suggestions when there is no transaction history", () => {
    renderForm();

    expect(screen.queryByText("최근 사용 결제수단")).toBeNull();
    expect(screen.queryByText("자주 쓰는 카테고리")).toBeNull();
  });
});
