"use client";
import { useActionState, useState } from "react";
export type GoalFormState = Readonly<{ status: "idle" | "success" | "error"; message?: string }>;
export function SavingsGoalForm({ action }: Readonly<{ action: (state: GoalFormState, formData: FormData) => Promise<GoalFormState> }>) {
  const [state, formAction] = useActionState(action, { status: "idle" });
  const [name, setName] = useState("");
  return <form action={formAction}><h2>Create savings goal</h2><label>Name<input name="name" value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Target amount<input name="targetAmount" inputMode="numeric" required /></label><label>Target date<input name="targetDate" type="date" required /></label><label>Monthly plan<input name="monthlyContributionPlan" inputMode="numeric" required /></label><button type="submit">Create goal</button>{state.status === "error" ? <p role="alert">{state.message}</p> : null}</form>;
}
