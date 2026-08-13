"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";

export type EditAccountActionState = Readonly<{ status: "idle" | "success" | "error"; message?: string }>;
export type EditAccountAction = (state: EditAccountActionState, formData: FormData) => Promise<EditAccountActionState>;

export type EditableAccount = Readonly<{
  id: string;
  name: string;
  type: "BANK" | "CASH" | "DEBIT" | "LIABILITY";
  linkedAccountId: string | null;
  balance: number;
}>;

export function EditAccountForm({
  account,
  bankAccounts,
  action,
}: Readonly<{
  account: EditableAccount;
  bankAccounts: readonly Readonly<{ id: string; name: string }>[];
  action: EditAccountAction;
}>) {
  const [state, formAction, isPending] = useActionState(action, { status: "idle" });

  return (
    <form action={formAction} className="flex flex-col gap-3 border-t border-border-subtle pt-3">
      <input type="hidden" name="accountId" value={account.id} />
      <TextField label="이름" name="name" defaultValue={account.name} required />

      {account.type === "DEBIT" ? (
        <Select label="연결할 은행 계좌" name="linkedAccountId" defaultValue={account.linkedAccountId ?? ""} required>
          {bankAccounts.map((bankAccount) => (
            <option key={bankAccount.id} value={bankAccount.id}>
              {bankAccount.name}
            </option>
          ))}
        </Select>
      ) : (
        <TextField
          label="잔액 직접 변경"
          name="balance"
          inputMode="numeric"
          pattern="\d*"
          defaultValue={account.balance}
          required
          hint="조정 내역을 남기지 않고 지금 보이는 잔액을 바로 이 숫자로 바꿔요."
        />
      )}

      <Button type="submit" variant="secondary" size="sm" disabled={isPending} className="self-start">
        {isPending ? "저장 중..." : "저장"}
      </Button>

      {state.status === "error" ? (
        <Alert kind="error" role="alert" className="py-1 text-xs">
          {state.message}
        </Alert>
      ) : null}
      {state.status === "success" ? (
        <Alert kind="success" role="status" className="py-1 text-xs">
          저장했습니다
        </Alert>
      ) : null}
    </form>
  );
}
