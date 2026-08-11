import "server-only";

export type MonthlyBudgetInput = Readonly<{
  year: number;
  month: number;
  totalBudget: number;
}>;

export type MonthlyBudgetRecord = Readonly<MonthlyBudgetInput & {
  id: string;
  userId: string;
}>;

export type CategoryBudgetInput = Readonly<{
  year: number;
  month: number;
  categoryId: string;
  baseBudget: number;
  rolloverEnabled: boolean;
  rolloverAmount: number;
}>;

export type CategoryBudgetRecord = Readonly<CategoryBudgetInput & {
  id: string;
  userId: string;
}>;

export type SavingsGoalInput = Readonly<{
  name: string;
  targetAmount: number;
  targetDate: string;
  monthlyContributionPlan: number;
}>;

export type SavingsGoalRecord = Readonly<SavingsGoalInput & {
  id: string;
  userId: string;
  isActive: boolean;
}>;

export type SavingsContributionInput = Readonly<{
  goalId: string;
  amount: number;
  contributionDate: string;
  transferId?: string;
}>;

export type SavingsContributionRecord = Readonly<SavingsContributionInput & {
  id: string;
  userId: string;
}>;

export type OwnedActiveCategory = Readonly<{
  id: string;
  userId: string;
  isActive: boolean;
}>;

export type OwnedSavingsGoal = Readonly<{
  id: string;
  userId: string;
}>;

export type OwnedTransfer = Readonly<{
  id: string;
  userId: string;
  type: string;
  status: string;
}>;

export interface PlanningRepository {
  findCategory(userId: string, id: string): Promise<OwnedActiveCategory | null>;
  findGoal(userId: string, id: string): Promise<OwnedSavingsGoal | null>;
  findTransfer(userId: string, id: string): Promise<OwnedTransfer | null>;

  listMonthlyBudgets(userId: string): Promise<MonthlyBudgetRecord[]>;
  createMonthlyBudget(userId: string, input: MonthlyBudgetInput): Promise<MonthlyBudgetRecord>;
  updateMonthlyBudget(userId: string, id: string, input: MonthlyBudgetInput): Promise<MonthlyBudgetRecord | null>;
  removeMonthlyBudget(userId: string, id: string): Promise<boolean>;

  listCategoryBudgets(userId: string): Promise<CategoryBudgetRecord[]>;
  createCategoryBudget(userId: string, input: CategoryBudgetInput): Promise<CategoryBudgetRecord>;
  updateCategoryBudget(userId: string, id: string, input: CategoryBudgetInput): Promise<CategoryBudgetRecord | null>;
  removeCategoryBudget(userId: string, id: string): Promise<boolean>;

  listSavingsGoals(userId: string): Promise<SavingsGoalRecord[]>;
  createSavingsGoal(userId: string, input: SavingsGoalInput): Promise<SavingsGoalRecord>;
  updateSavingsGoal(userId: string, id: string, input: SavingsGoalInput): Promise<SavingsGoalRecord | null>;
  deactivateSavingsGoal(userId: string, id: string): Promise<boolean>;

  listSavingsContributions(userId: string): Promise<SavingsContributionRecord[]>;
  createSavingsContribution(userId: string, input: SavingsContributionInput): Promise<SavingsContributionRecord>;
  updateSavingsContribution(userId: string, id: string, input: SavingsContributionInput): Promise<SavingsContributionRecord | null>;
  removeSavingsContribution(userId: string, id: string): Promise<boolean>;
}

const fail = (message: string): never => { throw new Error(message); };

function assertPeriod(year: number, month: number): void {
  if (!Number.isSafeInteger(year) || year < 1 || year > 9_999) fail("year must be between 1 and 9999");
  if (!Number.isSafeInteger(month) || month < 1 || month > 12) fail("month must be between 1 and 12");
}

function assertNonNegativeSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) fail(`${field} must be a non-negative safe integer`);
}

function assertSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value)) fail(`${field} must be a safe integer`);
}

function assertPositiveSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) fail(`${field} must be a positive safe integer`);
}

function assertValidIsoDate(value: string, field: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(`${field} must be a valid ISO date`);
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    fail(`${field} must be a valid ISO date`);
  }
}

function validateMonthlyBudget(input: MonthlyBudgetInput): MonthlyBudgetInput {
  assertPeriod(input.year, input.month);
  assertNonNegativeSafeInteger(input.totalBudget, "totalBudget");
  return input;
}

async function validateCategoryBudget(
  repository: PlanningRepository,
  userId: string,
  input: CategoryBudgetInput,
): Promise<CategoryBudgetInput> {
  assertPeriod(input.year, input.month);
  assertNonNegativeSafeInteger(input.baseBudget, "baseBudget");
  assertSafeInteger(input.rolloverAmount, "rolloverAmount");
  const category = await repository.findCategory(userId, input.categoryId);
  if (!category || category.userId !== userId || !category.isActive) {
    fail("categoryId must be an active category owned by the current user");
  }
  return input;
}

function validateSavingsGoal(input: SavingsGoalInput): SavingsGoalInput {
  const name = input.name.trim();
  if (!name) fail("name is required");
  assertPositiveSafeInteger(input.targetAmount, "targetAmount");
  assertNonNegativeSafeInteger(input.monthlyContributionPlan, "monthlyContributionPlan");
  assertValidIsoDate(input.targetDate, "targetDate");
  return { ...input, name };
}

async function validateSavingsContribution(
  repository: PlanningRepository,
  userId: string,
  input: SavingsContributionInput,
): Promise<SavingsContributionInput> {
  assertPositiveSafeInteger(input.amount, "amount");
  assertValidIsoDate(input.contributionDate, "contributionDate");
  const goal = await repository.findGoal(userId, input.goalId);
  if (!goal || goal.userId !== userId) fail("goalId must be owned by the current user");
  if (input.transferId !== undefined) {
    const transfer = await repository.findTransfer(userId, input.transferId);
    if (!transfer || transfer.userId !== userId || transfer.type !== "TRANSFER" || transfer.status !== "CONFIRMED") {
      fail("transferId must be a confirmed transfer owned by the current user");
    }
  }
  return input;
}

export function createPlanningService(repository: PlanningRepository) {
  return {
    listMonthlyBudgets: (userId: string) => repository.listMonthlyBudgets(userId),
    createMonthlyBudget: async (userId: string, input: MonthlyBudgetInput) =>
      repository.createMonthlyBudget(userId, validateMonthlyBudget(input)),
    updateMonthlyBudget: async (userId: string, id: string, input: MonthlyBudgetInput) => {
      const updated = await repository.updateMonthlyBudget(userId, id, validateMonthlyBudget(input));
      if (!updated) fail("monthly budget not found");
      return updated;
    },
    removeMonthlyBudget: async (userId: string, id: string) => {
      if (!await repository.removeMonthlyBudget(userId, id)) fail("monthly budget not found");
    },

    listCategoryBudgets: (userId: string) => repository.listCategoryBudgets(userId),
    createCategoryBudget: async (userId: string, input: CategoryBudgetInput) =>
      repository.createCategoryBudget(userId, await validateCategoryBudget(repository, userId, input)),
    updateCategoryBudget: async (userId: string, id: string, input: CategoryBudgetInput) => {
      const updated = await repository.updateCategoryBudget(
        userId,
        id,
        await validateCategoryBudget(repository, userId, input),
      );
      if (!updated) fail("category budget not found");
      return updated;
    },
    removeCategoryBudget: async (userId: string, id: string) => {
      if (!await repository.removeCategoryBudget(userId, id)) fail("category budget not found");
    },

    listSavingsGoals: (userId: string) => repository.listSavingsGoals(userId),
    createSavingsGoal: async (userId: string, input: SavingsGoalInput) =>
      repository.createSavingsGoal(userId, validateSavingsGoal(input)),
    updateSavingsGoal: async (userId: string, id: string, input: SavingsGoalInput) => {
      const updated = await repository.updateSavingsGoal(userId, id, validateSavingsGoal(input));
      if (!updated) fail("savings goal not found");
      return updated;
    },
    deactivateSavingsGoal: async (userId: string, id: string) => {
      if (!await repository.deactivateSavingsGoal(userId, id)) fail("savings goal not found");
    },

    listSavingsContributions: (userId: string) => repository.listSavingsContributions(userId),
    createSavingsContribution: async (userId: string, input: SavingsContributionInput) =>
      repository.createSavingsContribution(userId, await validateSavingsContribution(repository, userId, input)),
    updateSavingsContribution: async (userId: string, id: string, input: SavingsContributionInput) => {
      const updated = await repository.updateSavingsContribution(
        userId,
        id,
        await validateSavingsContribution(repository, userId, input),
      );
      if (!updated) fail("savings contribution not found");
      return updated;
    },
    removeSavingsContribution: async (userId: string, id: string) => {
      if (!await repository.removeSavingsContribution(userId, id)) fail("savings contribution not found");
    },
  };
}
