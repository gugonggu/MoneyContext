import { describe, expect, it } from "vitest";

import {
  createPlanningService,
  type CategoryBudgetInput,
  type CategoryBudgetRecord,
  type MonthlyBudgetInput,
  type MonthlyBudgetRecord,
  type OwnedActiveCategory,
  type OwnedSavingsGoal,
  type OwnedTransfer,
  type PlanningRepository,
  type SavingsContributionInput,
  type SavingsContributionRecord,
  type SavingsGoalInput,
  type SavingsGoalRecord,
} from "@/server/planning/service";

const userId = "user-a";
const otherUserId = "user-b";
const category: OwnedActiveCategory = { id: "category-a", userId, isActive: true };
const goal: OwnedSavingsGoal = { id: "goal-a", userId };
const confirmedTransfer: OwnedTransfer = { id: "transfer-a", userId, type: "TRANSFER", status: "CONFIRMED" };

const monthlyBudgetInput: MonthlyBudgetInput = { year: 2026, month: 8, totalBudget: 1_000_000 };
const categoryBudgetInput: CategoryBudgetInput = {
  year: 2026,
  month: 8,
  categoryId: category.id,
  baseBudget: 300_000,
  rolloverEnabled: true,
  rolloverAmount: 20_000,
};
const savingsGoalInput: SavingsGoalInput = {
  name: " Emergency fund ",
  targetAmount: 5_000_000,
  targetDate: "2027-08-11",
  monthlyContributionPlan: 300_000,
};
const contributionInput: SavingsContributionInput = {
  goalId: goal.id,
  amount: 300_000,
  contributionDate: "2026-08-11",
};

function repository(options: {
  categories?: readonly OwnedActiveCategory[];
  goals?: readonly OwnedSavingsGoal[];
  transfers?: readonly OwnedTransfer[];
} = {}): PlanningRepository {
  const categories = options.categories ?? [category];
  const seededGoals = options.goals ?? [goal];
  const transfers = options.transfers ?? [confirmedTransfer];
  const monthlyBudgets: MonthlyBudgetRecord[] = [];
  const categoryBudgets: CategoryBudgetRecord[] = [];
  const goals: SavingsGoalRecord[] = seededGoals.map((item) => ({
    id: item.id,
    userId: item.userId,
    name: "Existing goal",
    targetAmount: 1_000_000,
    targetDate: "2027-01-01",
    monthlyContributionPlan: 0,
    isActive: true,
  }));
  const contributions: SavingsContributionRecord[] = [];
  let nextId = 1;

  return {
    findCategory: async (_ownerId, id) => categories.find((item) => item.id === id) ?? null,
    findGoal: async (_ownerId, id) => goals.find((item) => item.id === id) ?? null,
    findTransfer: async (_ownerId, id) => transfers.find((item) => item.id === id) ?? null,
    listMonthlyBudgets: async (ownerId) => monthlyBudgets.filter((item) => item.userId === ownerId),
    createMonthlyBudget: async (ownerId, input) => {
      const row = { id: `monthly-${nextId++}`, userId: ownerId, ...input };
      monthlyBudgets.push(row);
      return row;
    },
    updateMonthlyBudget: async (ownerId, id, input) => {
      const row = monthlyBudgets.find((item) => item.id === id && item.userId === ownerId);
      if (!row) return null;
      const updated = { ...row, ...input };
      monthlyBudgets.splice(monthlyBudgets.indexOf(row), 1, updated);
      return updated;
    },
    removeMonthlyBudget: async (ownerId, id) => remove(monthlyBudgets, ownerId, id),
    listCategoryBudgets: async (ownerId) => categoryBudgets.filter((item) => item.userId === ownerId),
    createCategoryBudget: async (ownerId, input) => {
      const row = { id: `category-budget-${nextId++}`, userId: ownerId, ...input };
      categoryBudgets.push(row);
      return row;
    },
    updateCategoryBudget: async (ownerId, id, input) => {
      const row = categoryBudgets.find((item) => item.id === id && item.userId === ownerId);
      if (!row) return null;
      const updated = { ...row, ...input };
      categoryBudgets.splice(categoryBudgets.indexOf(row), 1, updated);
      return updated;
    },
    removeCategoryBudget: async (ownerId, id) => remove(categoryBudgets, ownerId, id),
    listSavingsGoals: async (ownerId) => goals.filter((item) => item.userId === ownerId),
    createSavingsGoal: async (ownerId, input) => {
      const row = { id: `goal-${nextId++}`, userId: ownerId, isActive: true, ...input };
      goals.push(row);
      return row;
    },
    updateSavingsGoal: async (ownerId, id, input) => {
      const row = goals.find((item) => item.id === id && item.userId === ownerId);
      if (!row) return null;
      const updated = { ...row, ...input };
      goals.splice(goals.indexOf(row), 1, updated);
      return updated;
    },
    deactivateSavingsGoal: async (ownerId, id) => {
      const row = goals.find((item) => item.id === id && item.userId === ownerId);
      if (!row) return false;
      row.isActive = false;
      return true;
    },
    listSavingsContributions: async (ownerId) => contributions.filter((item) => item.userId === ownerId),
    createSavingsContribution: async (ownerId, input) => {
      const row = { id: `contribution-${nextId++}`, userId: ownerId, ...input };
      contributions.push(row);
      return row;
    },
    updateSavingsContribution: async (ownerId, id, input) => {
      const row = contributions.find((item) => item.id === id && item.userId === ownerId);
      if (!row) return null;
      const updated = { ...row, ...input };
      contributions.splice(contributions.indexOf(row), 1, updated);
      return updated;
    },
    removeSavingsContribution: async (ownerId, id) => remove(contributions, ownerId, id),
  };
}

function remove<T extends { id: string; userId: string }>(rows: T[], ownerId: string, id: string): boolean {
  const row = rows.find((item) => item.id === id && item.userId === ownerId);
  if (!row) return false;
  rows.splice(rows.indexOf(row), 1);
  return true;
}

describe("planning service", () => {
  it.each([
    ["year below the supported calendar range", { year: 0 }, "year must be between 1 and 9999"],
    ["year above the supported calendar range", { year: 10_000 }, "year must be between 1 and 9999"],
    ["month below the calendar range", { month: 0 }, "month must be between 1 and 12"],
    ["month above the calendar range", { month: 13 }, "month must be between 1 and 12"],
    ["a fractional budget amount", { totalBudget: 1.5 }, "totalBudget must be a non-negative safe integer"],
    ["a negative budget amount", { totalBudget: -1 }, "totalBudget must be a non-negative safe integer"],
  ])("rejects a monthly budget with %s", async (_label, changes, message) => {
    const service = createPlanningService(repository());

    await expect(service.createMonthlyBudget(userId, { ...monthlyBudgetInput, ...changes })).rejects.toThrow(message);
  });

  it("creates, lists, updates, and removes a monthly budget within the caller scope", async () => {
    const service = createPlanningService(repository());
    const created = await service.createMonthlyBudget(userId, monthlyBudgetInput);

    await expect(service.listMonthlyBudgets(userId)).resolves.toEqual([created]);
    await expect(service.listMonthlyBudgets(otherUserId)).resolves.toEqual([]);
    await expect(service.updateMonthlyBudget(userId, created.id, { ...monthlyBudgetInput, totalBudget: 900_000 }))
      .resolves.toMatchObject({ totalBudget: 900_000 });
    await expect(service.removeMonthlyBudget(userId, created.id)).resolves.toBeUndefined();
  });

  it.each([
    ["an inactive category", [{ ...category, isActive: false }]],
    ["a category owned by another user", [{ ...category, userId: otherUserId }]],
  ])("rejects a category budget that references %s", async (_label, categories) => {
    const service = createPlanningService(repository({ categories }));

    await expect(service.createCategoryBudget(userId, categoryBudgetInput))
      .rejects.toThrow("categoryId must be an active category owned by the current user");
  });

  it("creates, lists, updates, and removes a category budget", async () => {
    const service = createPlanningService(repository());
    const created = await service.createCategoryBudget(userId, categoryBudgetInput);

    await expect(service.listCategoryBudgets(userId)).resolves.toEqual([created]);
    await expect(service.updateCategoryBudget(userId, created.id, { ...categoryBudgetInput, baseBudget: 250_000 }))
      .resolves.toMatchObject({ baseBudget: 250_000 });
    await expect(service.removeCategoryBudget(userId, created.id)).resolves.toBeUndefined();
  });

  it.each([
    ["an invalid target date", { targetDate: "2026-02-30" }, "targetDate must be a valid ISO date"],
    ["a blank name", { name: "  " }, "name is required"],
    ["a zero target amount", { targetAmount: 0 }, "targetAmount must be a positive safe integer"],
    ["a fractional target amount", { targetAmount: 1.5 }, "targetAmount must be a positive safe integer"],
  ])("rejects a savings goal with %s", async (_label, changes, message) => {
    const service = createPlanningService(repository());

    await expect(service.createSavingsGoal(userId, { ...savingsGoalInput, ...changes })).rejects.toThrow(message);
  });

  it("normalizes a goal name and supports update and deactivation", async () => {
    const service = createPlanningService(repository());
    const created = await service.createSavingsGoal(userId, savingsGoalInput);

    expect(created.name).toBe("Emergency fund");
    await expect(service.updateSavingsGoal(userId, created.id, { ...savingsGoalInput, name: "House" }))
      .resolves.toMatchObject({ name: "House" });
    await expect(service.deactivateSavingsGoal(userId, created.id)).resolves.toBeUndefined();
  });

  it.each([
    ["a missing goal", []],
    ["a goal owned by another user", [{ ...goal, userId: otherUserId }]],
  ])("rejects a contribution with %s", async (_label, goals) => {
    const service = createPlanningService(repository({ goals }));

    await expect(service.createSavingsContribution(userId, contributionInput))
      .rejects.toThrow("goalId must be owned by the current user");
  });

  it.each([
    ["a non-transfer transaction", [{ ...confirmedTransfer, type: "EXPENSE" }]],
    ["a pending transfer", [{ ...confirmedTransfer, status: "PENDING" }]],
    ["another user's transfer", [{ ...confirmedTransfer, userId: otherUserId }]],
  ])("rejects a contribution linked to %s", async (_label, transfers) => {
    const service = createPlanningService(repository({ transfers }));

    await expect(service.createSavingsContribution(userId, { ...contributionInput, transferId: confirmedTransfer.id }))
      .rejects.toThrow("transferId must be a confirmed transfer owned by the current user");
  });

  it("creates, lists, updates, and removes standalone and transfer-linked contributions", async () => {
    const service = createPlanningService(repository());
    const standalone = await service.createSavingsContribution(userId, contributionInput);
    const linked = await service.createSavingsContribution(userId, { ...contributionInput, transferId: confirmedTransfer.id });

    await expect(service.listSavingsContributions(userId)).resolves.toEqual([standalone, linked]);
    await expect(service.updateSavingsContribution(userId, standalone.id, { ...contributionInput, amount: 350_000 }))
      .resolves.toMatchObject({ amount: 350_000 });
    await expect(service.removeSavingsContribution(userId, linked.id)).resolves.toBeUndefined();
  });
});
