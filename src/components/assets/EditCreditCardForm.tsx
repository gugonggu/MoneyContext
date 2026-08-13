"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";

export type EditCreditCardActionState = Readonly<{ status: "idle" | "success" | "error"; message?: string }>;
export type EditCreditCardAction = (state: EditCreditCardActionState, formData: FormData) => Promise<EditCreditCardActionState>;

export type EditableCreditCard = Readonly<{
  id: string;
  name: string;
  paymentAccountId: string | null;
  paymentDay: number | null;
  creditLimit: number | null;
  firstPaymentDate: string | null;
}>;

export function EditCreditCardForm({
  card,
  bankAccounts,
  action,
}: Readonly<{
  card: EditableCreditCard;
  bankAccounts: readonly Readonly<{ id: string; name: string }>[];
  action: EditCreditCardAction;
}>) {
  const [state, formAction, isPending] = useActionState(action, { status: "idle" });

  return (
    <form action={formAction} className="flex flex-col gap-3 border-t border-white/20 pt-3">
      <input type="hidden" name="accountId" value={card.id} />
      <TextField label="카드 이름" name="name" defaultValue={card.name} required />
      <Select label="결제 계좌" name="paymentAccountId" defaultValue={card.paymentAccountId ?? ""} required>
        <option value="" disabled>
          선택해주세요
        </option>
        {bankAccounts.map((bankAccount) => (
          <option key={bankAccount.id} value={bankAccount.id}>
            {bankAccount.name}
          </option>
        ))}
      </Select>
      <TextField
        label="결제일"
        name="paymentDay"
        type="number"
        min="1"
        max="31"
        defaultValue={card.paymentDay ?? ""}
        required
        hint="매월 결제일 (1~31)"
      />
      <TextField label="한도 (선택)" name="creditLimit" inputMode="numeric" pattern="\d*" defaultValue={card.creditLimit ?? ""} />
      <TextField
        label="첫 결제일 (선택)"
        name="firstPaymentDate"
        type="date"
        defaultValue={card.firstPaymentDate ?? ""}
        hint="이 날짜 전 달까지는 결제일 표시가 뜨지 않아요."
      />

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
