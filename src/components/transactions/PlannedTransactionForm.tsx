"use client";

import { useActionState } from "react";

export type PlannedTransactionFormState = Readonly<{ status: "idle" | "success" | "error"; message?: string }>;
export type PlannedTransactionFormAction = (state: PlannedTransactionFormState, formData: FormData) => Promise<PlannedTransactionFormState>;

export function PlannedTransactionForm({
  accounts,
  categories,
  action,
}: Readonly<{
  accounts: readonly { id: string; name: string }[];
  categories: readonly { id: string; name: string }[];
  action: PlannedTransactionFormAction;
}>) {
  const [state, formAction] = useActionState(action, { status: "idle" });

  return (
    <form action={formAction}>
      <h2>예정 거래 추가</h2>

      <fieldset>
        <legend>유형</legend>
        <label>
          <input type="radio" name="type" value="EXPENSE" defaultChecked required />
          지출
        </label>
        <label>
          <input type="radio" name="type" value="INCOME" />
          수입
        </label>
      </fieldset>

      <label>
        예정일
        <input name="scheduledDate" type="date" required />
      </label>

      <label>
        금액
        <input name="amount" inputMode="numeric" pattern="\d*" required />
      </label>

      <label>
        결제수단
        <select name="accountId" required>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        카테고리 (선택)
        <select name="categoryId" defaultValue="">
          <option value="">선택 안 함</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        메모
        <input name="memo" type="text" />
      </label>

      {state.status === "error" ? <p role="alert">{state.message}</p> : null}
      {state.status === "success" ? <p role="status">저장했습니다.</p> : null}

      <button type="submit">예정 거래 추가</button>
    </form>
  );
}
