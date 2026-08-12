"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";

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
    <Card className="flex flex-col gap-5">
      <h2 className="text-base font-semibold text-slate-900">반복 거래 추가</h2>

      <form action={formAction} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-slate-700">유형</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" name="type" value="EXPENSE" defaultChecked required className="h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-600" />
              지출
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" name="type" value="INCOME" className="h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-600" />
              수입
            </label>
          </div>
        </fieldset>

        <TextField label="금액" name="amount" inputMode="numeric" pattern="\d*" required />

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <Select label="결제수단" name="accountId" required>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-1">
            <Select label="카테고리" name="categoryId" defaultValue="">
              <option value="">선택 안 함</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <TextField label="메모" name="memo" type="text" />

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <Select label="반복 주기" name="frequency" defaultValue="MONTHLY" required>
              <option value="DAILY">매일</option>
              <option value="WEEKLY">매주</option>
              <option value="MONTHLY">매월</option>
            </Select>
          </div>
          <div className="flex-1">
            <TextField label="반복 간격" name="intervalCount" inputMode="numeric" pattern="\d*" defaultValue="1" required />
          </div>
        </div>

        <TextField label="매월 반복일 (매월 주기인 경우)" name="dayOfMonth" inputMode="numeric" pattern="\d*" />

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <TextField label="시작일" name="startDate" type="date" required />
          </div>
          <div className="flex-1">
            <TextField label="종료일 (선택)" name="endDate" type="date" />
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-slate-700">확정 방식</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="confirmationMode"
                value="AUTO_CONFIRM"
                defaultChecked
                required
                className="h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-600"
              />
              자동 확정
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" name="confirmationMode" value="REQUIRE_CONFIRMATION" className="h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-600" />
              확인 후 확정
            </label>
          </div>
        </fieldset>

        {state.status === "error" ? (
          <Alert kind="error" role="alert">
            {state.message}
          </Alert>
        ) : null}
        {state.status === "success" ? (
          <Alert kind="success" role="status">
            저장했습니다.
          </Alert>
        ) : null}

        <Button type="submit" className="w-full">
          반복 거래 추가
        </Button>
      </form>
    </Card>
  );
}
