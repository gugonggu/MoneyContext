"use client";
import { useActionState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

export type BudgetFormState = Readonly<{ status: "idle" | "success" | "error"; message?: string }>;
export function MonthlyBudgetForm({ action }: Readonly<{ action: (state: BudgetFormState, formData: FormData) => Promise<BudgetFormState> }>) {
  const [state, formAction] = useActionState(action, { status: "idle" });
  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-semibold text-slate-900">Monthly budget</h2>
      <TextField label="Year" name="year" inputMode="numeric" required />
      <TextField label="Month" name="month" inputMode="numeric" required />
      <TextField label="Total budget" name="totalBudget" inputMode="numeric" required />
      <Button type="submit">Save budget</Button>
      {state.status === "error" ? <Alert kind="error" role="alert">{state.message}</Alert> : null}
    </form>
  );
}
