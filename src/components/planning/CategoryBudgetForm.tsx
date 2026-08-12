"use client";
import { useActionState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";

type State = Readonly<{ status: "idle" | "success" | "error"; message?: string }>;
export function CategoryBudgetForm({ categories, action }: Readonly<{ categories: readonly { id: string; name: string }[]; action: (state: State, formData: FormData) => Promise<State> }>) {
  const [state, formAction] = useActionState(action, { status: "idle" });
  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-semibold text-slate-900">Category budget</h2>
      <TextField label="Year" name="year" inputMode="numeric" required />
      <TextField label="Month" name="month" inputMode="numeric" required />
      <Select label="Category" name="categoryId" required>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </Select>
      <TextField label="Budget" name="baseBudget" inputMode="numeric" required />
      <TextField label="Rollover" name="rolloverAmount" inputMode="numeric" defaultValue="0" required />
      <Checkbox label="Enable rollover" name="rolloverEnabled" />
      <Button type="submit">Save category budget</Button>
      {state.status === "error" ? <Alert kind="error" role="alert">{state.message}</Alert> : null}
    </form>
  );
}
