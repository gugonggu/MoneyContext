"use client";
import { useActionState } from "react";
export type BudgetFormState = Readonly<{ status: "idle" | "success" | "error"; message?: string }>;
export function MonthlyBudgetForm({ action }: Readonly<{ action: (state: BudgetFormState, formData: FormData) => Promise<BudgetFormState> }>) {
  const [state, formAction] = useActionState(action, { status: "idle" });
  return <form action={formAction}><h2>Monthly budget</h2><label>Year<input name="year" inputMode="numeric" required /></label><label>Month<input name="month" inputMode="numeric" required /></label><label>Total budget<input name="totalBudget" inputMode="numeric" required /></label><button type="submit">Save budget</button>{state.status === "error" ? <p role="alert">{state.message}</p> : null}</form>;
}
