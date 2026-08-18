"use client";

import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";

export type EmergencyFundState = Readonly<{ status: "idle" | "success" | "error"; message?: string }>;
export type EmergencyFundAction = (state: EmergencyFundState, formData: FormData) => Promise<EmergencyFundState>;

export function EmergencyFundSettings({
  currentAmount,
  action,
}: Readonly<{ currentAmount: number | null; action: EmergencyFundAction }>) {
  const [state, formAction, isPending] = useActionState(action, { status: "idle" });
  const [amount, setAmount] = useState(currentAmount !== null ? String(currentAmount) : "");

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-content-primary">비상금 기준</h2>
      <p className="text-sm text-content-secondary">
        이 금액 이하로는 잔액을 떨어뜨리고 싶지 않다는 기준이에요. 사용 가능 금액(Safe-to-Spend) 계산에 사용됩니다.
      </p>
      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField
            label="비상금 (KRW)"
            name="amount"
            inputMode="numeric"
            pattern="\d*"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="예: 200000"
          />
        </div>
        <Button type="submit" disabled={isPending}>
          저장
        </Button>
      </form>
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
    </Card>
  );
}
