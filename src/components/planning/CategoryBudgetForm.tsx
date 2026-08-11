"use client";
import { useActionState } from "react";
type State = Readonly<{ status: "idle" | "success" | "error"; message?: string }>;
export function CategoryBudgetForm({ categories, action }: Readonly<{ categories: readonly { id: string; name: string }[]; action: (state: State, formData: FormData) => Promise<State> }>) {
  const [state, formAction] = useActionState(action, { status: "idle" });
  return <form action={formAction}><h2>Category budget</h2><label>Year<input name="year" inputMode="numeric" required /></label><label>Month<input name="month" inputMode="numeric" required /></label><label>Category<select name="categoryId" required>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Budget<input name="baseBudget" inputMode="numeric" required /></label><label>Rollover<input name="rolloverAmount" inputMode="numeric" defaultValue="0" required /></label><label><input name="rolloverEnabled" type="checkbox" />Enable rollover</label><button type="submit">Save category budget</button>{state.status === "error" ? <p role="alert">{state.message}</p> : null}</form>;
}
