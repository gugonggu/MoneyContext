"use client";
import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

export type GoalFormState = Readonly<{ status: "idle" | "success" | "error"; message?: string }>;
export function SavingsGoalForm({ action }: Readonly<{ action: (state: GoalFormState, formData: FormData) => Promise<GoalFormState> }>) {
  const [state, formAction] = useActionState(action, { status: "idle" });
  const [name, setName] = useState("");
  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-semibold text-slate-900">Create savings goal</h2>
      <TextField label="Name" name="name" value={name} onChange={(event) => setName(event.target.value)} required />
      <TextField label="Target amount" name="targetAmount" inputMode="numeric" required />
      <TextField label="Target date" name="targetDate" type="date" required />
      <TextField label="Monthly plan" name="monthlyContributionPlan" inputMode="numeric" required />
      <Button type="submit">Create goal</Button>
      {state.status === "error" ? <Alert kind="error" role="alert">{state.message}</Alert> : null}
    </form>
  );
}
