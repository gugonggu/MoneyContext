import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CategoryBudgetInput,
  CategoryBudgetRecord,
  MonthlyBudgetInput,
  MonthlyBudgetRecord,
  OwnedActiveCategory,
  OwnedSavingsGoal,
  OwnedTransfer,
  PlanningRepository,
  SavingsContributionInput,
  SavingsContributionRecord,
  SavingsGoalInput,
  SavingsGoalRecord,
} from "@/server/planning/service";

type MonthlyBudgetRow = Readonly<{
  id: string;
  user_id: string;
  year: number | string;
  month: number | string;
  total_budget: number | string;
}>;

type CategoryBudgetRow = Readonly<{
  id: string;
  user_id: string;
  year: number | string;
  month: number | string;
  category_id: string;
  base_budget: number | string;
  rollover_enabled: boolean;
  rollover_amount: number | string;
}>;

type SavingsGoalRow = Readonly<{
  id: string;
  user_id: string;
  name: string;
  target_amount: number | string;
  target_date: string;
  monthly_contribution_plan: number | string;
  is_active: boolean;
}>;

type SavingsContributionRow = Readonly<{
  id: string;
  user_id: string;
  goal_id: string;
  amount: number | string;
  contribution_date: string;
  transfer_id: string | null;
}>;

const toMonthlyBudgetRecord = (row: MonthlyBudgetRow): MonthlyBudgetRecord => ({
  id: row.id,
  userId: row.user_id,
  year: Number(row.year),
  month: Number(row.month),
  totalBudget: Number(row.total_budget),
});

const toCategoryBudgetRecord = (row: CategoryBudgetRow): CategoryBudgetRecord => ({
  id: row.id,
  userId: row.user_id,
  year: Number(row.year),
  month: Number(row.month),
  categoryId: row.category_id,
  baseBudget: Number(row.base_budget),
  rolloverEnabled: row.rollover_enabled,
  rolloverAmount: Number(row.rollover_amount),
});

const toSavingsGoalRecord = (row: SavingsGoalRow): SavingsGoalRecord => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  targetAmount: Number(row.target_amount),
  targetDate: row.target_date,
  monthlyContributionPlan: Number(row.monthly_contribution_plan),
  isActive: row.is_active,
});

const toSavingsContributionRecord = (row: SavingsContributionRow): SavingsContributionRecord => ({
  id: row.id,
  userId: row.user_id,
  goalId: row.goal_id,
  amount: Number(row.amount),
  contributionDate: row.contribution_date,
  ...(row.transfer_id === null ? {} : { transferId: row.transfer_id }),
});

const monthlyBudgetPayload = (input: MonthlyBudgetInput) => ({
  year: input.year,
  month: input.month,
  total_budget: input.totalBudget,
});

const categoryBudgetPayload = (input: CategoryBudgetInput) => ({
  year: input.year,
  month: input.month,
  category_id: input.categoryId,
  base_budget: input.baseBudget,
  rollover_enabled: input.rolloverEnabled,
  rollover_amount: input.rolloverAmount,
});

const savingsGoalPayload = (input: SavingsGoalInput) => ({
  name: input.name,
  target_amount: input.targetAmount,
  target_date: input.targetDate,
  monthly_contribution_plan: input.monthlyContributionPlan,
});

const savingsContributionPayload = (input: SavingsContributionInput) => ({
  goal_id: input.goalId,
  amount: input.amount,
  contribution_date: input.contributionDate,
  transfer_id: input.transferId ?? null,
});

export function createPlanningRepository(supabase: SupabaseClient): PlanningRepository {
  return {
    async findCategory(userId, id): Promise<OwnedActiveCategory | null> {
      const { data, error } = await supabase
        .from("categories")
        .select("id,user_id,is_active")
        .eq("user_id", userId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { id: data.id, userId: data.user_id, isActive: data.is_active } : null;
    },

    async findGoal(userId, id): Promise<OwnedSavingsGoal | null> {
      const { data, error } = await supabase
        .from("savings_goals")
        .select("id,user_id")
        .eq("user_id", userId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { id: data.id, userId: data.user_id } : null;
    },

    async findTransfer(userId, id): Promise<OwnedTransfer | null> {
      const { data, error } = await supabase
        .from("transactions")
        .select("id,user_id,type,status")
        .eq("user_id", userId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { id: data.id, userId: data.user_id, type: data.type, status: data.status } : null;
    },

    async listMonthlyBudgets(userId) {
      const { data, error } = await supabase
        .from("monthly_budgets")
        .select("*")
        .eq("user_id", userId)
        .order("year")
        .order("month");
      if (error) throw new Error(error.message);
      return (data as MonthlyBudgetRow[]).map(toMonthlyBudgetRecord);
    },

    async createMonthlyBudget(userId, input) {
      const { data, error } = await supabase
        .from("monthly_budgets")
        .upsert({ user_id: userId, ...monthlyBudgetPayload(input) }, { onConflict: "user_id,year,month" })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return toMonthlyBudgetRecord(data as MonthlyBudgetRow);
    },

    async updateMonthlyBudget(userId, id, input) {
      const { data, error } = await supabase
        .from("monthly_budgets")
        .update(monthlyBudgetPayload(input))
        .eq("user_id", userId)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toMonthlyBudgetRecord(data as MonthlyBudgetRow) : null;
    },

    async removeMonthlyBudget(userId, id) {
      const { data, error } = await supabase
        .from("monthly_budgets")
        .delete()
        .eq("user_id", userId)
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data !== null;
    },

    async listCategoryBudgets(userId) {
      const { data, error } = await supabase
        .from("category_budgets")
        .select("*")
        .eq("user_id", userId)
        .order("year")
        .order("month");
      if (error) throw new Error(error.message);
      return (data as CategoryBudgetRow[]).map(toCategoryBudgetRecord);
    },

    async createCategoryBudget(userId, input) {
      const { data, error } = await supabase
        .from("category_budgets")
        .upsert({ user_id: userId, ...categoryBudgetPayload(input) }, { onConflict: "user_id,year,month,category_id" })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return toCategoryBudgetRecord(data as CategoryBudgetRow);
    },

    async updateCategoryBudget(userId, id, input) {
      const { data, error } = await supabase
        .from("category_budgets")
        .update(categoryBudgetPayload(input))
        .eq("user_id", userId)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toCategoryBudgetRecord(data as CategoryBudgetRow) : null;
    },

    async removeCategoryBudget(userId, id) {
      const { data, error } = await supabase
        .from("category_budgets")
        .delete()
        .eq("user_id", userId)
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data !== null;
    },

    async listSavingsGoals(userId) {
      const { data, error } = await supabase
        .from("savings_goals")
        .select("*")
        .eq("user_id", userId)
        .order("target_date");
      if (error) throw new Error(error.message);
      return (data as SavingsGoalRow[]).map(toSavingsGoalRecord);
    },

    async createSavingsGoal(userId, input) {
      const { data, error } = await supabase
        .from("savings_goals")
        .insert({ user_id: userId, ...savingsGoalPayload(input) })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return toSavingsGoalRecord(data as SavingsGoalRow);
    },

    async updateSavingsGoal(userId, id, input) {
      const { data, error } = await supabase
        .from("savings_goals")
        .update(savingsGoalPayload(input))
        .eq("user_id", userId)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toSavingsGoalRecord(data as SavingsGoalRow) : null;
    },

    async deactivateSavingsGoal(userId, id) {
      const { data, error } = await supabase
        .from("savings_goals")
        .update({ is_active: false })
        .eq("user_id", userId)
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data !== null;
    },

    async listSavingsContributions(userId) {
      const { data, error } = await supabase
        .from("savings_contributions")
        .select("*")
        .eq("user_id", userId)
        .order("contribution_date");
      if (error) throw new Error(error.message);
      return (data as SavingsContributionRow[]).map(toSavingsContributionRecord);
    },

    async createSavingsContribution(userId, input) {
      const { data, error } = await supabase
        .from("savings_contributions")
        .insert({ user_id: userId, ...savingsContributionPayload(input) })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return toSavingsContributionRecord(data as SavingsContributionRow);
    },

    async updateSavingsContribution(userId, id, input) {
      const { data, error } = await supabase
        .from("savings_contributions")
        .update(savingsContributionPayload(input))
        .eq("user_id", userId)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toSavingsContributionRecord(data as SavingsContributionRow) : null;
    },

    async removeSavingsContribution(userId, id) {
      const { data, error } = await supabase
        .from("savings_contributions")
        .delete()
        .eq("user_id", userId)
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data !== null;
    },
  };
}
