"use client";

import { useActionState } from "react";

export type RecurringRuleFormState = Readonly<{ status: "idle" | "success" | "error"; message?: string }>;
export type RecurringRuleFormAction = (state: RecurringRuleFormState, formData: FormData) => Promise<RecurringRuleFormState>;

export function RecurringRuleForm({
  accounts,
  categories,
  action,
}: Readonly<{
  accounts: readonly { id: string; name: string }[];
  categories: readonly { id: string; name: string }[];
  action: RecurringRuleFormAction;
}>) {
  const [state, formAction] = useActionState(action, { status: "idle" });

  return (
    <form action={formAction}>
      <h2>반복 거래 추가</h2>

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
        카테고리
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

      <label>
        반복 주기
        <select name="frequency" defaultValue="MONTHLY" required>
          <option value="DAILY">매일</option>
          <option value="WEEKLY">매주</option>
          <option value="MONTHLY">매월</option>
        </select>
      </label>

      <label>
        반복 간격
        <input name="intervalCount" inputMode="numeric" pattern="\d*" defaultValue="1" required />
      </label>

      <label>
        매월 반복일 (매월 주기인 경우)
        <input name="dayOfMonth" inputMode="numeric" pattern="\d*" />
      </label>

      <label>
        시작일
        <input name="startDate" type="date" required />
      </label>

      <label>
        종료일 (선택)
        <input name="endDate" type="date" />
      </label>

      <fieldset>
        <legend>확정 방식</legend>
        <label>
          <input type="radio" name="confirmationMode" value="AUTO_CONFIRM" defaultChecked required />
          자동 확정
        </label>
        <label>
          <input type="radio" name="confirmationMode" value="REQUIRE_CONFIRMATION" />
          확인 후 확정
        </label>
      </fieldset>

      {state.status === "error" ? <p role="alert">{state.message}</p> : null}
      {state.status === "success" ? <p role="status">저장했습니다.</p> : null}

      <button type="submit">반복 거래 추가</button>
    </form>
  );
}
