import "server-only";

export type AccountType = "BANK" | "CASH" | "DEBIT" | "CREDIT_CARD" | "LIABILITY";

export type AccountRecord = Readonly<{
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  linkedAccountId: string | null;
  isActive: boolean;
  sortOrder: number;
}>;

export type CreateAccountInput = Readonly<{
  name: string;
  type: AccountType;
  initialBalance: number;
  linkedAccountId?: string;
  sortOrder?: number;
}>;

export type UpdateAccountInput = Readonly<{
  name?: string;
  initialBalance?: number;
  linkedAccountId?: string;
  sortOrder?: number;
}>;

export type CreateCreditCardSettingsInput = Readonly<{
  accountId: string;
  paymentAccountId: string;
  paymentDay: number;
  creditLimit?: number;
  firstPaymentDate?: string;
}>;

export type UpdateCreditCardSettingsInput = Readonly<{
  paymentAccountId: string;
  paymentDay: number;
  creditLimit?: number;
  firstPaymentDate?: string;
}>;

export type CreditCardSettingsRecord = Readonly<{
  id: string;
  userId: string;
  accountId: string;
  paymentAccountId: string;
  paymentDay: number;
  creditLimit: number | null;
  firstPaymentDate: string | null;
}>;

type AccountChanges = {
  name?: string;
  initialBalance?: number;
  linkedAccountId?: string | null;
  sortOrder?: number;
};

export interface AccountRepository {
  list(userId: string, activeOnly: boolean): Promise<AccountRecord[]>;
  findById(userId: string, accountId: string): Promise<AccountRecord | null>;
  create(userId: string, input: Omit<AccountRecord, "id" | "userId" | "isActive">): Promise<AccountRecord>;
  update(userId: string, accountId: string, input: AccountChanges): Promise<AccountRecord | null>;
  deactivate(userId: string, accountId: string): Promise<boolean>;
  createCreditCardSettings(userId: string, input: Omit<CreditCardSettingsRecord, "id" | "userId">): Promise<CreditCardSettingsRecord>;
  updateCreditCardSettings(userId: string, accountId: string, input: { paymentAccountId: string; paymentDay: number; creditLimit: number | null; firstPaymentDate: string | null }): Promise<CreditCardSettingsRecord | null>;
  listCreditCardSettings(userId: string): Promise<CreditCardSettingsRecord[]>;
}

function invalid(message: string): never {
  throw new Error(message);
}

function normalizeName(name: string): string {
  const normalized = name.trim();
  if (!normalized) invalid("name is required");
  return normalized;
}

function assertNonNegativeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) invalid(`${field} must be a non-negative integer`);
}

function assertSortOrder(value: number): void {
  if (!Number.isSafeInteger(value)) invalid("sortOrder must be an integer");
}

function assertPaymentDay(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 31) invalid("paymentDay must be between 1 and 31");
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function assertFirstPaymentDate(value: string): void {
  if (!ISO_DATE.test(value)) invalid("firstPaymentDate must be a YYYY-MM-DD date");
}

async function requireLinkedBank(userId: string, linkedAccountId: string | undefined, repository: AccountRepository): Promise<string> {
  if (!linkedAccountId) invalid("DEBIT accounts require a linked BANK account");
  const linkedAccount = await repository.findById(userId, linkedAccountId);
  if (!linkedAccount || !linkedAccount.isActive || linkedAccount.type !== "BANK") {
    invalid("DEBIT accounts require a linked BANK account owned by the current user");
  }
  return linkedAccount.id;
}

export function createAccountService(repository: AccountRepository) {
  return {
    async list(userId: string, activeOnly = true): Promise<AccountRecord[]> {
      return repository.list(userId, activeOnly);
    },

    async create(userId: string, input: CreateAccountInput): Promise<AccountRecord> {
      const name = normalizeName(input.name);
      assertNonNegativeInteger(input.initialBalance, "initialBalance");
      const sortOrder = input.sortOrder ?? 0;
      assertSortOrder(sortOrder);
      const linkedAccountId = input.type === "DEBIT"
        ? await requireLinkedBank(userId, input.linkedAccountId, repository)
        : null;

      return repository.create(userId, {
        name,
        type: input.type,
        initialBalance: input.initialBalance,
        linkedAccountId,
        sortOrder,
      });
    },

    async update(userId: string, accountId: string, input: UpdateAccountInput): Promise<AccountRecord> {
      const account = await repository.findById(userId, accountId);
      if (!account || !account.isActive) invalid("account not found");
      const update: AccountChanges = {};
      if (input.name !== undefined) update.name = normalizeName(input.name);
      if (input.initialBalance !== undefined) {
        assertNonNegativeInteger(input.initialBalance, "initialBalance");
        update.initialBalance = input.initialBalance;
      }
      if (input.sortOrder !== undefined) {
        assertSortOrder(input.sortOrder);
        update.sortOrder = input.sortOrder;
      }
      if (account.type === "DEBIT" && input.linkedAccountId !== undefined) {
        update.linkedAccountId = await requireLinkedBank(userId, input.linkedAccountId, repository);
      }
      const updated = await repository.update(userId, accountId, update);
      if (!updated) invalid("account not found");
      return updated;
    },

    async deactivate(userId: string, accountId: string): Promise<void> {
      if (!await repository.deactivate(userId, accountId)) invalid("account not found");
    },

    async createCreditCardSettings(userId: string, input: CreateCreditCardSettingsInput): Promise<CreditCardSettingsRecord> {
      assertPaymentDay(input.paymentDay);
      if (input.creditLimit !== undefined) assertNonNegativeInteger(input.creditLimit, "creditLimit");
      if (input.firstPaymentDate !== undefined) assertFirstPaymentDate(input.firstPaymentDate);
      const [card, paymentAccount] = await Promise.all([
        repository.findById(userId, input.accountId),
        repository.findById(userId, input.paymentAccountId),
      ]);
      if (!card || !card.isActive || card.type !== "CREDIT_CARD") invalid("accountId must reference an active CREDIT_CARD account");
      if (!paymentAccount || !paymentAccount.isActive || paymentAccount.type !== "BANK") {
        invalid("paymentAccountId must reference an active BANK account owned by the current user");
      }
      return repository.createCreditCardSettings(userId, {
        accountId: card.id,
        paymentAccountId: paymentAccount.id,
        paymentDay: input.paymentDay,
        creditLimit: input.creditLimit ?? null,
        firstPaymentDate: input.firstPaymentDate ?? null,
      });
    },

    async updateCreditCardSettings(userId: string, accountId: string, input: UpdateCreditCardSettingsInput): Promise<CreditCardSettingsRecord> {
      assertPaymentDay(input.paymentDay);
      if (input.creditLimit !== undefined) assertNonNegativeInteger(input.creditLimit, "creditLimit");
      if (input.firstPaymentDate !== undefined) assertFirstPaymentDate(input.firstPaymentDate);
      const [card, paymentAccount] = await Promise.all([
        repository.findById(userId, accountId),
        repository.findById(userId, input.paymentAccountId),
      ]);
      if (!card || !card.isActive || card.type !== "CREDIT_CARD") invalid("accountId must reference an active CREDIT_CARD account");
      if (!paymentAccount || !paymentAccount.isActive || paymentAccount.type !== "BANK") {
        invalid("paymentAccountId must reference an active BANK account owned by the current user");
      }
      const updated = await repository.updateCreditCardSettings(userId, accountId, {
        paymentAccountId: paymentAccount.id,
        paymentDay: input.paymentDay,
        creditLimit: input.creditLimit ?? null,
        firstPaymentDate: input.firstPaymentDate ?? null,
      });
      if (!updated) invalid("credit card settings not found");
      return updated;
    },

    listCreditCardSettings(userId: string): Promise<CreditCardSettingsRecord[]> {
      return repository.listCreditCardSettings(userId);
    },
  };
}
