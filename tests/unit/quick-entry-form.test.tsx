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
  defaultDate?: string,
) {
  render(
    <QuickEntryForm
      accounts={accounts}
      categories={categories}
      tags={tags}
      action={action}
      recentTransactions={recentTransactions}
      today={today}
      defaultDate={defaultDate}
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

  it("switches to source/destination account selectors for a TRANSFER and still offers a category to label it", () => {
    renderForm();

    fireEvent.click(screen.getByRole("radio", { name: "이체" }));

    expect(screen.getByLabelText("출금 계좌")).toBeTruthy();
    expect(screen.getByLabelText("입금 계좌")).toBeTruthy();
    expect(screen.getByLabelText("카테고리")).toBeTruthy();
  });

  it("shows only the source account for an external transfer out, and submits without a destination", async () => {
    const action = renderForm();

    fireEvent.click(screen.getByRole("radio", { name: "이체" }));
    fireEvent.click(screen.getByRole("radio", { name: "외부로 송금" }));

    expect(screen.getByLabelText("출금 계좌")).toBeTruthy();
    expect(screen.queryByLabelText("입금 계좌")).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: "30000" } });
    fireEvent.submit(screen.getByRole("button", { name: "저장" }).closest("form")!);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const submitted = action.mock.calls[0][1] as FormData;
    expect(submitted.get("fromAccountId")).toBe("bank-a");
    expect(submitted.has("toAccountId")).toBe(false);
  });

  it("shows only the destination account for an external transfer in, and submits without a source", async () => {
    const action = renderForm();

    fireEvent.click(screen.getByRole("radio", { name: "이체" }));
    fireEvent.click(screen.getByRole("radio", { name: "외부에서 받음" }));

    expect(screen.queryByLabelText("출금 계좌")).toBeNull();
    expect(screen.getByLabelText("입금 계좌")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: "30000" } });
    fireEvent.submit(screen.getByRole("button", { name: "저장" }).closest("form")!);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const submitted = action.mock.calls[0][1] as FormData;
    expect(submitted.has("fromAccountId")).toBe(false);
    expect(submitted.get("toAccountId")).toBeTruthy();
  });

  it("shows date, memo, tags, FX, and installment options expanded by default", () => {
    renderForm();

    expect(screen.getByRole("button", { name: "상세 옵션 숨기기" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByLabelText("메모")).toBeTruthy();
    expect(screen.getByLabelText("날짜/시간")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "업무" })).toBeTruthy();
    expect(screen.getByLabelText("통화")).toBeTruthy();
  });

  it("can still be collapsed and re-expanded", () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: /상세 옵션/ }));
    expect(screen.queryByLabelText("메모")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /상세 옵션/ }));
    expect(screen.getByLabelText("메모")).toBeTruthy();
  });

  it("seeds noon when a calendar date is provided", () => {
    renderForm(undefined, [], "2026-08-05");

    expect((screen.getByLabelText("날짜/시간") as HTMLInputElement).value).toBe("2026-08-05T12:00");
  });

  it("only offers installment for EXPENSE transactions on a CREDIT_CARD account", () => {
    renderForm();

    expect(screen.getByRole("checkbox", { name: "할부로 결제" })).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "수입" }));
    expect(screen.queryByRole("checkbox", { name: "할부로 결제" })).toBeNull();
  });

  it("reveals the installment count field once installment is checked", () => {
    renderForm();

    expect(screen.queryByLabelText("할부 개월")).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "할부로 결제" }));
    expect(screen.getByLabelText("할부 개월")).toBeTruthy();
  });

  it("suggests the purchase date as the first installment payment date when the card has no registered payment day", () => {
    renderForm();

    fireEvent.click(screen.getByRole("checkbox", { name: "할부로 결제" }));

    expect((screen.getByLabelText(/^첫 결제일/) as HTMLInputElement).value).toBe(today);
  });

  it("suggests the card's own payment day instead of the purchase date once one is registered", () => {
    render(
      <QuickEntryForm
        accounts={[
          { id: "bank-a", name: "주거래 은행", type: "BANK" },
          { id: "card-a", name: "신용카드", type: "CREDIT_CARD", paymentDay: 25 },
        ]}
        categories={categories}
        tags={tags}
        action={vi.fn(async () => ({ status: "idle" as const }))}
        today={today}
      />,
    );

    fireEvent.change(screen.getByLabelText("결제수단"), { target: { value: "card-a" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "할부로 결제" }));

    // today is 2026-08-11, before the 25th, so this cycle's 25th applies.
    expect((screen.getByLabelText(/^첫 결제일/) as HTMLInputElement).value).toBe("2026-08-25");
  });

  it("lets the user override the suggested first installment payment date", async () => {
    const action = vi.fn(async () => ({ status: "idle" as const }));
    renderForm(action);

    fireEvent.change(screen.getByLabelText("금액"), { target: { value: "300000" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "할부로 결제" }));
    fireEvent.change(screen.getByLabelText(/^첫 결제일/), { target: { value: "2026-09-01" } });

    const form = screen.getByLabelText(/^첫 결제일/).closest("form");
    if (!form) throw new Error("form not found");
    fireEvent.submit(form);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const submitted = action.mock.calls[0][1] as FormData;
    expect(submitted.get("installmentFirstPaymentDate")).toBe("2026-09-01");
  });

  it("preserves entered values and shows the error message when the action fails", async () => {
    const action = vi.fn(async () => ({ status: "error" as const, message: "저장에 실패했습니다" }));
    renderForm(action);

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

  it("clears amount, category, date/time, and memo after a successful save", async () => {
    const action = vi.fn(async () => ({ status: "success" as const }));
    renderForm(action);

    fireEvent.change(screen.getByLabelText("금액"), { target: { value: "4500" } });
    fireEvent.change(screen.getByLabelText("카테고리"), { target: { value: "cat-food" } });
    fireEvent.change(screen.getByLabelText("날짜/시간"), { target: { value: "2026-08-11T09:00" } });
    fireEvent.change(screen.getByLabelText("메모"), { target: { value: "커피" } });

    const form = screen.getByLabelText("메모").closest("form");
    if (!form) throw new Error("form not found");
    fireEvent.submit(form);

    await waitFor(() => screen.getByRole("status"));
    await waitFor(() => expect((screen.getByLabelText("금액") as HTMLInputElement).value).toBe(""));
    expect((screen.getByLabelText("카테고리") as HTMLSelectElement).value).toBe("");
    expect((screen.getByLabelText("날짜/시간") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("메모") as HTMLInputElement).value).toBe("");
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

  it("does not offer a way to add a category when no onCreateCategory handler is given", () => {
    renderForm();

    expect(screen.queryByText("+ 새 카테고리 추가")).toBeNull();
  });

  it("creates a new category, selects it, and disables submit until it exists", async () => {
    const onCreateCategory = vi.fn(async (name: string, kind: "INCOME" | "EXPENSE") => ({ id: "cat-new", name, kind }));
    render(
      <QuickEntryForm
        accounts={accounts}
        categories={categories}
        tags={tags}
        action={vi.fn(async () => ({ status: "idle" as const }))}
        onCreateCategory={onCreateCategory}
        today={today}
      />,
    );

    fireEvent.change(screen.getByLabelText("카테고리"), { target: { value: "__new__" } });
    expect((screen.getByRole("button", { name: "저장" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("새 카테고리 이름"), { target: { value: "용돈" } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    await waitFor(() => expect(onCreateCategory).toHaveBeenCalledWith("용돈", "EXPENSE"));
    await waitFor(() => expect((screen.getByLabelText("카테고리") as HTMLSelectElement).value).toBe("cat-new"));
    expect(screen.getByRole("option", { name: "용돈" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "저장" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("labels a new category created from the TRANSFER tab as BOTH so it fits either direction", async () => {
    const onCreateCategory = vi.fn(async (name: string, kind: "INCOME" | "EXPENSE" | "BOTH") => ({ id: "cat-new", name, kind }));
    render(
      <QuickEntryForm
        accounts={accounts}
        categories={categories}
        tags={tags}
        action={vi.fn(async () => ({ status: "idle" as const }))}
        onCreateCategory={onCreateCategory}
        today={today}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "이체" }));
    fireEvent.change(screen.getByLabelText("카테고리"), { target: { value: "__new__" } });
    fireEvent.change(screen.getByLabelText("새 카테고리 이름"), { target: { value: "지인 송금" } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    await waitFor(() => expect(onCreateCategory).toHaveBeenCalledWith("지인 송금", "BOTH"));
  });

  it("reports an accessible error when creating a category fails", async () => {
    const onCreateCategory = vi.fn(async () => {
      throw new Error("카테고리를 추가하지 못했습니다");
    });
    render(
      <QuickEntryForm
        accounts={accounts}
        categories={categories}
        tags={tags}
        action={vi.fn(async () => ({ status: "idle" as const }))}
        onCreateCategory={onCreateCategory}
        today={today}
      />,
    );

    fireEvent.change(screen.getByLabelText("카테고리"), { target: { value: "__new__" } });
    fireEvent.change(screen.getByLabelText("새 카테고리 이름"), { target: { value: "용돈" } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect((await screen.findByRole("alert")).textContent).toContain("카테고리를 추가하지 못했습니다");
  });
});
