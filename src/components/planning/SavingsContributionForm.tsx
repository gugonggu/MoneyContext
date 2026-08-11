"use client";
import { useActionState } from "react";
type State = Readonly<{ status: "idle" | "success" | "error"; message?: string }>;
export function SavingsContributionForm({ goals, action }: Readonly<{ goals: readonly { id: string; name: string }[]; action: (state: State, formData: FormData) => Promise<State> }>) {
  const [state, formAction] = useActionState(action, { status: "idle" });
  return <form action={formAction}><h2>Add savings contribution</h2><label>Goal<select name="goalId" required>{goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}</select></label><label>Amount<input name="amount" inputMode="numeric" required /></label><label>Date<input name="contributionDate" type="date" required /></label><button type="submit">Add contribution</button>{state.status === "error" ? <p role="alert">{state.message}</p> : null}</form>;
}
