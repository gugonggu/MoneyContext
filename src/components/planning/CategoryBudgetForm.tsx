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
    <form action={formAction} className="flex flex-col gap-4 rounded-card border border-border-subtle bg-surface-raised p-4 shadow-card sm:p-5">
      <h2 className="text-base font-semibold text-content-primary">카테고리 예산</h2>
      <TextField label="연도" name="year" inputMode="numeric" required />
      <TextField label="월" name="month" inputMode="numeric" required />
      <Select label="카테고리" name="categoryId" required>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </Select>
      <TextField label="예산" name="baseBudget" inputMode="numeric" required />
      <TextField label="이월액" name="rolloverAmount" inputMode="numeric" defaultValue="0" required />
      <Checkbox label="이월 활성화" name="rolloverEnabled" />
      <Button type="submit">카테고리 예산 저장</Button>
      {state.status === "error" ? <Alert kind="error" role="alert">{state.message}</Alert> : null}
    </form>
  );
}
