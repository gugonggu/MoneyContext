import "server-only";

import { nextOccurrenceDate } from "@/domain/recurring/schedule";

export type RecurringInput = Readonly<{
  type: "INCOME" | "EXPENSE";
  amount: number;
  currency: string;
  accountId: string;
  categoryId?: string;
  memo?: string;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  intervalCount: number;
  dayOfMonth?: number;
  startDate: string;
  endDate?: string;
  confirmationMode: "AUTO_CONFIRM" | "REQUIRE_CONFIRMATION";
}>;

export type OwnedActiveAccount = Readonly<{ id: string; userId: string; isActive: boolean }>;
export type OwnedActiveCategory = Readonly<{ id: string; userId: string; isActive: boolean }>;
export type ValidRecurringInput = RecurringInput & Readonly<{ nextRunDate: string }>;
export type RecurringRule = ValidRecurringInput & Readonly<{ id: string; userId: string; isActive: boolean }>;
export type GeneratedOccurrence = Readonly<{ ruleId: string; occurrenceDate: string; status: "CONFIRMED" | "PENDING" }>;

export interface RecurringRepository {
  findAccount(userId: string, id: string): Promise<OwnedActiveAccount | null>;
  findCategory(userId: string, id: string): Promise<OwnedActiveCategory | null>;
  createRule(userId: string, input: ValidRecurringInput): Promise<RecurringRule>;
  listRules(userId: string): Promise<RecurringRule[]>;
  updateRule(userId: string, id: string, input: ValidRecurringInput): Promise<RecurringRule | null>;
  deactivateRule(userId: string, id: string): Promise<boolean>;
  generateDue(userId: string, today: string): Promise<GeneratedOccurrence[]>;
}

const fail = (message: string): never => { throw new Error(message); };

function assertValidIsoDate(value: string, name: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(`${name} must be a valid ISO date`);
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    fail(`${name} must be a valid ISO date`);
  }
}

async function validate(repository: RecurringRepository, userId: string, input: RecurringInput): Promise<ValidRecurringInput> {
  if (input.type !== "INCOME" && input.type !== "EXPENSE") fail("type must be INCOME or EXPENSE");
  if (!Number.isSafeInteger(input.amount) || input.amount < 0) fail("amount must be a non-negative safe integer");
  if (input.currency !== "KRW") fail("recurring transaction currency must be KRW");
  if (input.confirmationMode !== "AUTO_CONFIRM" && input.confirmationMode !== "REQUIRE_CONFIRMATION") fail("confirmationMode is invalid");
  if (input.frequency !== "DAILY" && input.frequency !== "WEEKLY" && input.frequency !== "MONTHLY") fail("frequency is invalid");
  assertValidIsoDate(input.startDate, "startDate");
  if (input.endDate !== undefined) {
    assertValidIsoDate(input.endDate, "endDate");
    if (input.endDate < input.startDate) fail("endDate must not be before startDate");
  }

  try {
    nextOccurrenceDate({
      frequency: input.frequency,
      intervalCount: input.intervalCount,
      dayOfMonth: input.dayOfMonth,
      occurrenceDate: input.startDate,
    });
  } catch (error) {
    if (error instanceof Error) throw error;
    fail("recurrence is invalid");
  }

  const account = await repository.findAccount(userId, input.accountId);
  if (!account || !account.isActive || account.userId !== userId) fail("account must be an active account owned by the current user");
  if (input.categoryId) {
    const category = await repository.findCategory(userId, input.categoryId);
    if (!category || !category.isActive || category.userId !== userId) fail("category must be an active category owned by the current user");
  }

  return { ...input, nextRunDate: input.startDate };
}

export function createRecurringTransactionService(repository: RecurringRepository) {
  return {
    list: (userId: string) => repository.listRules(userId),
    create: async (userId: string, input: RecurringInput) => repository.createRule(userId, await validate(repository, userId, input)),
    update: async (userId: string, id: string, input: RecurringInput) => {
      const rule = await repository.updateRule(userId, id, await validate(repository, userId, input));
      if (!rule) fail("recurring rule not found");
      return rule;
    },
    deactivate: async (userId: string, id: string) => {
      if (!await repository.deactivateRule(userId, id)) fail("recurring rule not found");
    },
    generateDue: async (userId: string, today: string) => {
      assertValidIsoDate(today, "today");
      return repository.generateDue(userId, today);
    },
  };
}
