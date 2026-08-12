import { revalidatePath } from "next/cache";

import { PlanningOverview } from "@/components/planning/PlanningOverview";
import { SavingsGoalForm } from "@/components/planning/SavingsGoalForm";
import { MonthlyBudgetForm } from "@/components/planning/MonthlyBudgetForm";
import { CategoryBudgetForm } from "@/components/planning/CategoryBudgetForm";
import { SavingsContributionForm } from "@/components/planning/SavingsContributionForm";
import { listCategoriesForCurrentUser } from "@/server/categories";
import { createCategoryBudgetForCurrentUser, createMonthlyBudgetForCurrentUser, createSavingsContributionForCurrentUser, createSavingsGoalForCurrentUser, getPlanningOverviewForCurrentUser } from "@/server/planning";

async function addContribution(_: { status: "idle" | "success" | "error"; message?: string }, formData: FormData) {
  "use server";
  try { const amount = Number(formData.get("amount")); if (!Number.isSafeInteger(amount)) throw new Error("Enter a whole-number amount"); await createSavingsContributionForCurrentUser({ goalId: String(formData.get("goalId")), amount, contributionDate: String(formData.get("contributionDate")) }); revalidatePath("/plans"); return { status: "success" as const }; } catch (error) { return { status: "error" as const, message: error instanceof Error ? error.message : "Unable to add contribution" }; }
}

async function saveCategoryBudget(_: { status: "idle" | "success" | "error"; message?: string }, formData: FormData) {
  "use server";
  try { const year = Number(formData.get("year")); const month = Number(formData.get("month")); const baseBudget = Number(formData.get("baseBudget")); const rolloverAmount = Number(formData.get("rolloverAmount")); if (![year, month, baseBudget, rolloverAmount].every(Number.isSafeInteger)) throw new Error("Enter whole-number values"); await createCategoryBudgetForCurrentUser({ year, month, categoryId: String(formData.get("categoryId")), baseBudget, rolloverEnabled: formData.get("rolloverEnabled") === "on", rolloverAmount }); revalidatePath("/plans"); return { status: "success" as const }; } catch (error) { return { status: "error" as const, message: error instanceof Error ? error.message : "Unable to save category budget" }; }
}

async function saveMonthlyBudget(_: { status: "idle" | "success" | "error"; message?: string }, formData: FormData) {
  "use server";
  try {
    const year = Number(String(formData.get("year") ?? "")); const month = Number(String(formData.get("month") ?? "")); const totalBudget = Number(String(formData.get("totalBudget") ?? ""));
    if (![year, month, totalBudget].every(Number.isSafeInteger)) throw new Error("Enter whole-number values");
    await createMonthlyBudgetForCurrentUser({ year, month, totalBudget });
    revalidatePath("/plans");
    return { status: "success" as const };
  } catch (error) { return { status: "error" as const, message: error instanceof Error ? error.message : "Unable to save budget" }; }
}

async function createGoal(_: { status: "idle" | "success" | "error"; message?: string }, formData: FormData) {
  "use server";
  try {
    const targetAmount = Number(String(formData.get("targetAmount") ?? ""));
    const monthlyContributionPlan = Number(String(formData.get("monthlyContributionPlan") ?? ""));
    if (!Number.isSafeInteger(targetAmount) || !Number.isSafeInteger(monthlyContributionPlan)) throw new Error("Enter whole-number amounts");
    await createSavingsGoalForCurrentUser({ name: String(formData.get("name") ?? ""), targetAmount, targetDate: String(formData.get("targetDate") ?? ""), monthlyContributionPlan });
    revalidatePath("/plans");
    return { status: "success" as const };
  } catch (error) { return { status: "error" as const, message: error instanceof Error ? error.message : "Unable to create goal" }; }
}

export default async function PlansPage() {
  const [overview, categories] = await Promise.all([getPlanningOverviewForCurrentUser(), listCategoriesForCurrentUser()]);
  return <><PlanningOverview overview={overview} /><MonthlyBudgetForm action={saveMonthlyBudget} /><CategoryBudgetForm categories={categories.map(({ id, name }) => ({ id, name }))} action={saveCategoryBudget} /><SavingsGoalForm action={createGoal} /><SavingsContributionForm goals={overview.goals.map(({ id, name }) => ({ id, name }))} action={addContribution} /></>;
}
