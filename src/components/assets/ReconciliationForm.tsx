"use client";

import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

export type ReconciliationActionState = Readonly<{ status: "idle" | "success" | "error"; message?: string }>;
export type ReconciliationAction = (state: ReconciliationActionState, formData: FormData) => Promise<ReconciliationActionState>;

export function ReconciliationForm({ accountId, accountName, action }: Readonly<{ accountId: string; accountName: string; action: ReconciliationAction }>) {
  const [state, formAction, isPending] = useActionState(action, { status: "idle" });
  const [actualBalance, setActualBalance] = useState("");
  return (
    <form action={formAction} className="flex flex-col gap-1.5 sm:items-end">
      <input type="hidden" name="accountId" value={accountId} />
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          {accountName} 실제 잔액
          <input
            name="actualBalance"
            inputMode="numeric"
            pattern="-?\d*"
            required
            value={actualBalance}
            onChange={(event) => setActualBalance(event.target.value)}
            className="w-28 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>
        <Button
          type="submit"
          variant="secondary"
          aria-label={`${accountName} 잔액 조정`}
          disabled={isPending}
          className="px-2.5 py-1 text-xs"
        >
          잔액 조정
        </Button>
      </div>
      {state.status === "error" ? <Alert kind="error" role="alert" className="py-1 text-xs">{state.message}</Alert> : null}
      {state.status === "success" ? <Alert kind="success" role="status" className="py-1 text-xs">조정 완료</Alert> : null}
    </form>
  );
}
