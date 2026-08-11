import "server-only";

import { requireCurrentProfile } from "@/server/auth/require-profile";
import { createPlanningRepository } from "@/server/planning/repository";
import { createPlanningReadRepository } from "@/server/planning/read-repository";
import { createPlanningReadService } from "@/server/planning/read-service";
import { createPlanningService } from "@/server/planning/service";
import { createSupabaseServerClient } from "@/server/supabase/server";

export { createPlanningRepository } from "@/server/planning/repository";
export { createPlanningReadRepository } from "@/server/planning/read-repository";
export { createPlanningReadService } from "@/server/planning/read-service";
export { createPlanningService } from "@/server/planning/service";
export type {
  CategoryBudgetInput,
  CategoryBudgetRecord,
  MonthlyBudgetInput,
  MonthlyBudgetRecord,
  PlanningRepository,
  SavingsContributionInput,
  SavingsContributionRecord,
  SavingsGoalInput,
  SavingsGoalRecord,
} from "@/server/planning/service";

async function current() {
  const [profile, supabase] = await Promise.all([requireCurrentProfile(), createSupabaseServerClient()]);
  return { userId: profile.id, service: createPlanningService(createPlanningRepository(supabase)) };
}

export async function listMonthlyBudgetsForCurrentUser() {
  const { userId, service } = await current();
  return service.listMonthlyBudgets(userId);
}

export async function createMonthlyBudgetForCurrentUser(input: import("@/server/planning/service").MonthlyBudgetInput) {
  const { userId, service } = await current();
  return service.createMonthlyBudget(userId, input);
}

export async function updateMonthlyBudgetForCurrentUser(id: string, input: import("@/server/planning/service").MonthlyBudgetInput) {
  const { userId, service } = await current();
  return service.updateMonthlyBudget(userId, id, input);
}

export async function removeMonthlyBudgetForCurrentUser(id: string) {
  const { userId, service } = await current();
  return service.removeMonthlyBudget(userId, id);
}

export async function listCategoryBudgetsForCurrentUser() {
  const { userId, service } = await current();
  return service.listCategoryBudgets(userId);
}

export async function createCategoryBudgetForCurrentUser(input: import("@/server/planning/service").CategoryBudgetInput) {
  const { userId, service } = await current();
  return service.createCategoryBudget(userId, input);
}

export async function updateCategoryBudgetForCurrentUser(id: string, input: import("@/server/planning/service").CategoryBudgetInput) {
  const { userId, service } = await current();
  return service.updateCategoryBudget(userId, id, input);
}

export async function removeCategoryBudgetForCurrentUser(id: string) {
  const { userId, service } = await current();
  return service.removeCategoryBudget(userId, id);
}

export async function listSavingsGoalsForCurrentUser() {
  const { userId, service } = await current();
  return service.listSavingsGoals(userId);
}

export async function createSavingsGoalForCurrentUser(input: import("@/server/planning/service").SavingsGoalInput) {
  const { userId, service } = await current();
  return service.createSavingsGoal(userId, input);
}

export async function updateSavingsGoalForCurrentUser(id: string, input: import("@/server/planning/service").SavingsGoalInput) {
  const { userId, service } = await current();
  return service.updateSavingsGoal(userId, id, input);
}

export async function deactivateSavingsGoalForCurrentUser(id: string) {
  const { userId, service } = await current();
  return service.deactivateSavingsGoal(userId, id);
}

export async function listSavingsContributionsForCurrentUser() {
  const { userId, service } = await current();
  return service.listSavingsContributions(userId);
}

export async function createSavingsContributionForCurrentUser(input: import("@/server/planning/service").SavingsContributionInput) {
  const { userId, service } = await current();
  return service.createSavingsContribution(userId, input);
}

export async function updateSavingsContributionForCurrentUser(id: string, input: import("@/server/planning/service").SavingsContributionInput) {
  const { userId, service } = await current();
  return service.updateSavingsContribution(userId, id, input);
}

export async function removeSavingsContributionForCurrentUser(id: string) {
  const { userId, service } = await current();
  return service.removeSavingsContribution(userId, id);
}

export async function getPlanningOverviewForCurrentUser() {
  const [profile, supabase] = await Promise.all([requireCurrentProfile(), createSupabaseServerClient()]);
  return createPlanningReadService(createPlanningReadRepository(supabase)).getOverview(profile.id);
}
