"use client";

import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";

export type AddAccountActionState = Readonly<{ status: "idle" | "success" | "error"; message?: string }>;
export type AddAccountAction = (state: AddAccountActionState, formData: FormData) => Promise<AddAccountActionState>;

const TYPE_OPTIONS = [
  { value: "BANK", label: "은행 계좌" },
  { value: "CASH", label: "현금" },
  { value: "DEBIT", label: "체크카드" },
  { value: "CREDIT_CARD", label: "신용카드" },
  { value: "LIABILITY", label: "부채" },
] as const;

type AccountTypeOption = (typeof TYPE_OPTIONS)[number]["value"];

export function AddAccountForm({
  bankAccounts,
  action,
}: Readonly<{ bankAccounts: readonly Readonly<{ id: string; name: string }>[]; action: AddAccountAction }>) {
  const [state, formAction, isPending] = useActionState(action, { status: "idle" });
  const [type, setType] = useState<AccountTypeOption>("BANK");
  const needsBankAccount = type === "DEBIT" || type === "CREDIT_CARD";

  return (
    <Card variant="glass" className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-content-primary">새 계좌·카드 추가</h2>

      <form action={formAction} className="flex flex-col gap-4">
        <Select label="종류" name="type" value={type} onChange={(event) => setType(event.target.value as AccountTypeOption)}>
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <TextField label="이름" name="name" required />

        {type === "BANK" || type === "CASH" || type === "LIABILITY" ? (
          <TextField label="현재 잔액" name="initialBalance" inputMode="numeric" pattern="\d*" defaultValue="0" required />
        ) : null}

        {type === "DEBIT" ? (
          <Select label="연결할 은행 계좌" name="linkedAccountId" required defaultValue="">
            <option value="" disabled>
              {bankAccounts.length ? "선택해주세요" : "먼저 은행 계좌를 추가해주세요"}
            </option>
            {bankAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        ) : null}

        {type === "CREDIT_CARD" ? (
          <>
            <Select label="결제 계좌" name="paymentAccountId" required defaultValue="">
              <option value="" disabled>
                {bankAccounts.length ? "선택해주세요" : "먼저 은행 계좌를 추가해주세요"}
              </option>
              {bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
            <TextField label="결제일" name="paymentDay" type="number" min="1" max="31" required hint="매월 결제일 (1~31)" />
            <TextField label="한도 (선택)" name="creditLimit" inputMode="numeric" pattern="\d*" />
            <TextField
              label="첫 결제일 (선택)"
              name="firstPaymentDate"
              type="date"
              hint="카드를 발급받은 지 얼마 안 됐다면, 실제 첫 청구가 되는 날짜를 입력하세요. 그 전 달까지는 결제일 표시가 뜨지 않아요."
            />
          </>
        ) : null}

        <Button type="submit" disabled={isPending || (needsBankAccount && bankAccounts.length === 0)} className="self-start">
          {isPending ? "추가 중..." : "추가"}
        </Button>

        {state.status === "error" ? (
          <Alert kind="error" role="alert">
            {state.message}
          </Alert>
        ) : null}
        {state.status === "success" ? (
          <Alert kind="success" role="status">
            추가했습니다
          </Alert>
        ) : null}
      </form>
    </Card>
  );
}
