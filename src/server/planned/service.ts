import "server-only";

export type PlannedTransactionType = "INCOME" | "EXPENSE";
export type PlannedStatus = "PLANNED" | "CONFIRMED" | "CANCELLED";

export type PlannedTransactionInput = Readonly<{
  type: PlannedTransactionType;
  scheduledDate: string;
  amount: number;
  currency: string;
  baseAmount?: number;
  exchangeRate?: string;
  accountId?: string;
  categoryId?: string;
  memo?: string;
}>;

export type ValidPlannedTransactionInput = PlannedTransactionInput;

export type PlannedTransactionRecord = Readonly<
  PlannedTransactionInput & {
    id: string;
    userId: string;
    status: PlannedStatus;
    convertedTransactionId?: string;
  }
>;

export type OwnedActiveAccount = Readonly<{ id: string; userId: string; isActive: boolean }>;
export type OwnedActiveCategory = Readonly<{ id: string; userId: string; isActive: boolean }>;

export interface PlannedRepository {
  findAccount(userId: string, id: string): Promise<OwnedActiveAccount | null>;
  findCategory(userId: string, id: string): Promise<OwnedActiveCategory | null>;
  find(userId: string, id: string): Promise<PlannedTransactionRecord | null>;
  create(userId: string, input: ValidPlannedTransactionInput): Promise<PlannedTransactionRecord>;
  list(userId: string): Promise<PlannedTransactionRecord[]>;
  update(userId: string, id: string, input: ValidPlannedTransactionInput): Promise<PlannedTransactionRecord | null>;
  remove(userId: string, id: string): Promise<boolean>;
  confirm(userId: string, id: string): Promise<PlannedTransactionRecord | null>;
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

function validateCurrency(input: PlannedTransactionInput): void {
  if (!/^[A-Z]{3}$/.test(input.currency)) fail("currency must be an ISO 4217 code");
  if (input.currency === "KRW") {
    if (input.baseAmount !== undefined && input.baseAmount !== input.amount) fail("KRW baseAmount must equal amount");
  } else if (
    input.exchangeRate !== undefined &&
    (!/^\d+(?:\.\d+)?$/.test(input.exchangeRate) || Number(input.exchangeRate) <= 0)
  ) {
    fail("exchangeRate must be a positive number");
  } else if (input.exchangeRate === undefined) {
    fail("a foreign currency requires a positive exchangeRate");
  }
}

async function validate(
  repository: PlannedRepository,
  userId: string,
  input: PlannedTransactionInput,
): Promise<ValidPlannedTransactionInput> {
  if (input.type !== "INCOME" && input.type !== "EXPENSE") fail("type must be INCOME or EXPENSE");
  if (!Number.isSafeInteger(input.amount) || input.amount < 0) fail("amount must be a non-negative safe integer");
  if (input.baseAmount !== undefined && (!Number.isSafeInteger(input.baseAmount) || input.baseAmount < 0)) {
    fail("baseAmount must be a non-negative safe integer");
  }
  validateCurrency(input);
  assertValidIsoDate(input.scheduledDate, "scheduledDate");

  if (input.accountId) {
    const account = await repository.findAccount(userId, input.accountId);
    if (!account || account.userId !== userId || !account.isActive) {
      fail("accountId must be an active account owned by the current user");
    }
  }
  if (input.categoryId) {
    const category = await repository.findCategory(userId, input.categoryId);
    if (!category || category.userId !== userId || !category.isActive) {
      fail("categoryId must be an active category owned by the current user");
    }
  }

  return input;
}

async function requirePlanned(repository: PlannedRepository, userId: string, id: string): Promise<PlannedTransactionRecord> {
  const row = await repository.find(userId, id);
  if (!row) throw new Error("planned transaction not found");
  return row;
}

export function createPlannedTransactionService(repository: PlannedRepository) {
  return {
    list: (userId: string) => repository.list(userId),

    create: async (userId: string, input: PlannedTransactionInput) =>
      repository.create(userId, await validate(repository, userId, input)),

    update: async (userId: string, id: string, input: PlannedTransactionInput) => {
      const row = await requirePlanned(repository, userId, id);
      if (row.status !== "PLANNED") fail("only a PLANNED transaction can be modified");
      const updated = await repository.update(userId, id, await validate(repository, userId, input));
      if (!updated) fail("planned transaction not found");
      return updated;
    },

    remove: async (userId: string, id: string) => {
      const row = await requirePlanned(repository, userId, id);
      if (row.status === "CONFIRMED") fail("a confirmed planned transaction cannot be deleted");
      if (!(await repository.remove(userId, id))) fail("planned transaction not found");
    },

    confirm: async (userId: string, id: string) => {
      const row = await requirePlanned(repository, userId, id);
      if (row.status === "CONFIRMED") fail("planned transaction already confirmed");
      if (row.status === "CANCELLED") fail("cancelled planned transaction cannot be confirmed");
      const confirmed = await repository.confirm(userId, id);
      if (!confirmed) fail("planned transaction already confirmed");
      return confirmed;
    },
  };
}
