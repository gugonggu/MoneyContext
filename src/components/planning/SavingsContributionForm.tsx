"use client";
import { useActionState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";

type State = Readonly<{ status: "idle" | "success" | "error"; message?: string }>;
export function SavingsContributionForm({ goals, action }: Readonly<{ goals: readonly { id: string; name: string }[]; action: (state: State, formData: FormData) => Promise<State> }>) {
  const [state, formAction] = useActionState(action, { status: "idle" });
  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-card border border-border-subtle bg-surface-raised p-4 shadow-card sm:p-5">
      <h2 className="text-base font-semibold text-content-primary">저축 납입 추가</h2>
      <Select label="목표" name="goalId" required>
        {goals.map((goal) => (
          <option key={goal.id} value={goal.id}>
            {goal.name}
          </option>
        ))}
      </Select>
      <TextField label="금액" name="amount" inputMode="numeric" required />
      <TextField label="날짜" name="contributionDate" type="date" required />
      <Button type="submit">납입 추가</Button>
      {state.status === "error" ? <Alert kind="error" role="alert">{state.message}</Alert> : null}
    </form>
  );
}
