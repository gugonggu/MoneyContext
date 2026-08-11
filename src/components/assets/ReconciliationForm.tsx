"use client";

import { useActionState, useState } from "react";

export type ReconciliationActionState = Readonly<{ status: "idle" | "success" | "error"; message?: string }>;
export type ReconciliationAction = (state: ReconciliationActionState, formData: FormData) => Promise<ReconciliationActionState>;

export function ReconciliationForm({ accountId, accountName, action }: Readonly<{ accountId: string; accountName: string; action: ReconciliationAction }>) {
  const [state, formAction, isPending] = useActionState(action, { status: "idle" });
  const [actualBalance, setActualBalance] = useState("");
  return <form action={formAction}>
    <input type="hidden" name="accountId" value={accountId} />
    <label>Actual balance for {accountName}<input name="actualBalance" inputMode="numeric" pattern="-?\d*" required value={actualBalance} onChange={(event) => setActualBalance(event.target.value)} /></label>
    <button type="submit" aria-label={`Reconcile ${accountName}`} disabled={isPending}>Reconcile</button>
    {state.status === "error" ? <p role="alert">{state.message}</p> : null}
    {state.status === "success" ? <p role="status">Reconciled</p> : null}
  </form>;
}
