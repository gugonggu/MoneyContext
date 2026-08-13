"use client";
import { useActionState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

export type BudgetFormState = Readonly<{ status: "idle" | "success" | "error"; message?: string }>;
export function MonthlyBudgetForm({ action }: Readonly<{ action: (state: BudgetFormState, formData: FormData) => Promise<BudgetFormState> }>) {
  const [state, formAction] = useActionState(action, { status: "idle" });
  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-card border border-border-subtle bg-surface-raised p-4 shadow-card sm:p-5">
      <h2 className="text-base font-semibold text-content-primary">월 예산</h2>
      <TextField label="연도" name="year" inputMode="numeric" required />
      <TextField label="월" name="month" inputMode="numeric" required />
      <TextField label="총 예산" name="totalBudget" inputMode="numeric" required />
      <Button type="submit">예산 저장</Button>
      {state.status === "error" ? <Alert kind="error" role="alert">{state.message}</Alert> : null}
    </form>
  );
}
