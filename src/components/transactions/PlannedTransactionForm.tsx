"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";

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
    <Card className="flex flex-col gap-5">
      <h2 className="text-base font-semibold text-content-primary">예정 거래 추가</h2>

      <form action={formAction} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-content-secondary">유형</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-content-secondary">
              <input type="radio" name="type" value="EXPENSE" defaultChecked required className="h-4 w-4 border-border-strong text-brand-600 focus:ring-brand-600" />
              지출
            </label>
            <label className="flex items-center gap-2 text-sm text-content-secondary">
              <input type="radio" name="type" value="INCOME" className="h-4 w-4 border-border-strong text-brand-600 focus:ring-brand-600" />
              수입
            </label>
          </div>
        </fieldset>

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <TextField label="예정일" name="scheduledDate" type="date" required />
          </div>
          <div className="flex-1">
            <TextField label="금액" name="amount" inputMode="numeric" pattern="\d*" required />
          </div>
        </div>

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
            <Select label="카테고리 (선택)" name="categoryId" defaultValue="">
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
          예정 거래 추가
        </Button>
      </form>
    </Card>
  );
}
