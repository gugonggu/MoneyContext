import "server-only";

export type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT";
type Account = Readonly<{ id: string; userId: string; type: "BANK" | "CASH" | "DEBIT" | "CREDIT_CARD" | "LIABILITY"; isActive: boolean }>;
type Category = Readonly<{ id: string; userId: string; isActive: boolean }>;
type TransactionInput = Readonly<{ type: TransactionType; amount: number; baseAmount: number; currency: string; transactionAt: string; accountId?: string; fromAccountId?: string; toAccountId?: string; categoryId?: string; exchangeRate?: string; memo?: string }>;
export type TransactionRecord = Readonly<TransactionInput & { id: string; userId: string }>;
export type PatternTransaction = Readonly<{ accountId: string; categoryId?: string; type: "INCOME" | "EXPENSE"; transactionAt: string }>;
export type TransactionStatus = "PENDING" | "CONFIRMED" | "CANCELLED";
export type TransactionSearchFilters = Readonly<{
  from?: string;
  to?: string;
  type?: TransactionType;
  accountId?: string;
  categoryId?: string;
  tagId?: string;
  status?: TransactionStatus;
  minAmount?: number;
  maxAmount?: number;
  memo?: string;
  limit?: number;
  offset?: number;
}>;
export type TransactionSearchPage = Readonly<{ items: readonly TransactionSearchResult[]; hasMore: boolean }>;
export type TransactionSearchResult = Readonly<{
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  transactionAt: string;
  amount: number;
  currency: string;
  baseAmount: number;
  categoryId?: string;
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  memo?: string;
  tagNames: readonly string[];
}>;
export interface TransactionRepository {
  findAccount(userId: string, id: string): Promise<Account | null>;
  findCategory(userId: string, id: string): Promise<Category | null>;
  create(userId: string, input: TransactionInput): Promise<TransactionRecord>;
  list(userId: string): Promise<TransactionRecord[]>;
  update(userId: string, id: string, input: TransactionInput): Promise<TransactionRecord | null>;
  remove(userId: string, id: string): Promise<boolean>;
  listRecentForPatterns(userId: string, limit: number): Promise<PatternTransaction[]>;
  search(userId: string, filters: TransactionSearchFilters): Promise<TransactionSearchPage>;
  get(userId: string, id: string): Promise<TransactionRecord | null>;
}
const MIN_PATTERN_LIMIT = 1;
const MAX_PATTERN_LIMIT = 500;
const DEFAULT_PATTERN_LIMIT = 200;
function clampPatternLimit(limit: number): number {
  return Math.min(Math.max(MIN_PATTERN_LIMIT, Math.trunc(limit)), MAX_PATTERN_LIMIT);
}
const MIN_SEARCH_LIMIT = 1;
const MAX_SEARCH_LIMIT = 100;
const DEFAULT_SEARCH_LIMIT = 20;
function clampSearchLimit(limit: number | undefined): number {
  return Math.min(Math.max(MIN_SEARCH_LIMIT, Math.trunc(limit ?? DEFAULT_SEARCH_LIMIT)), MAX_SEARCH_LIMIT);
}
function clampSearchOffset(offset: number | undefined): number {
  return Math.max(0, Math.trunc(offset ?? 0));
}
function validateSearchFilters(filters: TransactionSearchFilters): TransactionSearchFilters {
  if (filters.minAmount !== undefined) validAmount(filters.minAmount, "minAmount");
  if (filters.maxAmount !== undefined) validAmount(filters.maxAmount, "maxAmount");
  if (filters.minAmount !== undefined && filters.maxAmount !== undefined && filters.maxAmount < filters.minAmount) {
    fail("maxAmount must not be less than minAmount");
  }
  if (filters.from !== undefined && Number.isNaN(Date.parse(filters.from))) fail("from must be a valid date");
  if (filters.to !== undefined && Number.isNaN(Date.parse(filters.to))) fail("to must be a valid date");
  if (filters.from !== undefined && filters.to !== undefined && filters.to < filters.from) fail("to must not be before from");
  return { ...filters, limit: clampSearchLimit(filters.limit), offset: clampSearchOffset(filters.offset) };
}
const fail = (message: string): never => { throw new Error(message); };
function validAmount(value: number, name: string, allowNegative = false) {
  if (!Number.isSafeInteger(value) || (!allowNegative && value < 0)) fail(`${name} must be a non-negative integer`);
}
function validCurrency(input: TransactionInput) {
  if (!/^[A-Z]{3}$/.test(input.currency)) fail("currency must be an ISO 4217 code");
  if (input.currency === "KRW" && input.amount !== input.baseAmount) fail("KRW baseAmount must equal amount");
  if (input.currency !== "KRW" && (!input.exchangeRate || !/^\d+(?:\.\d+)?$/.test(input.exchangeRate) || Number(input.exchangeRate) <= 0)) fail("foreign currency requires a positive exchangeRate");
}
async function active(repository: TransactionRepository, userId: string, id: string | undefined) {
  if (!id) throw new Error("account is required");
  const account = await repository.findAccount(userId, id);
  if (!account || !account.isActive) throw new Error("account must be an active account owned by the current user");
  return account.id;
}
async function activeCategory(repository: TransactionRepository, userId: string, id: string | undefined) {
  if (!id) return undefined;
  const category = await repository.findCategory(userId, id);
  if (!category || !category.isActive) throw new Error("categoryId must be an active category owned by the current user");
  return category.id;
}
async function validate(repository: TransactionRepository, userId: string, input: TransactionInput): Promise<TransactionInput> {
  const isAdjustment = input.type === "ADJUSTMENT";
  validAmount(input.amount, "amount", isAdjustment); validAmount(input.baseAmount, "baseAmount", isAdjustment); validCurrency(input);
  if (Number.isNaN(Date.parse(input.transactionAt))) fail("transactionAt must be an ISO timestamp");
  if (input.type === "TRANSFER") {
    if (!input.fromAccountId || !input.toAccountId || input.fromAccountId === input.toAccountId) fail("TRANSFER requires distinct source and destination accounts");
    return { ...input, accountId: undefined, categoryId: undefined, fromAccountId: await active(repository, userId, input.fromAccountId), toAccountId: await active(repository, userId, input.toAccountId) };
  }
  return { ...input, accountId: await active(repository, userId, input.accountId), categoryId: await activeCategory(repository, userId, input.categoryId), fromAccountId: undefined, toAccountId: undefined };
}
export function createTransactionService(repository: TransactionRepository) { return {
  list: (userId: string) => repository.list(userId),
  create: async (userId: string, input: TransactionInput) => repository.create(userId, await validate(repository, userId, input)),
  update: async (userId: string, id: string, input: TransactionInput) => { const row = await repository.update(userId, id, await validate(repository, userId, input)); if (!row) fail("transaction not found"); return row; },
  remove: async (userId: string, id: string) => { if (!await repository.remove(userId, id)) fail("transaction not found"); },
  listRecentForPatterns: (userId: string, limit: number = DEFAULT_PATTERN_LIMIT) => repository.listRecentForPatterns(userId, clampPatternLimit(limit)),
  search: async (userId: string, filters: TransactionSearchFilters) => repository.search(userId, validateSearchFilters(filters)),
  get: async (userId: string, id: string) => { const row = await repository.get(userId, id); if (!row) throw new Error("transaction not found"); return row; },
}; }
