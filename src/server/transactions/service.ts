import "server-only";

export type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT";
type Account = Readonly<{ id: string; userId: string; type: "BANK" | "CASH" | "DEBIT" | "CREDIT_CARD" | "LIABILITY"; isActive: boolean }>;
type TransactionInput = Readonly<{ type: TransactionType; amount: number; baseAmount: number; currency: string; transactionAt: string; accountId?: string; fromAccountId?: string; toAccountId?: string; exchangeRate?: string; memo?: string }>;
export type TransactionRecord = Readonly<TransactionInput & { id: string; userId: string }>;
export interface TransactionRepository {
  findAccount(userId: string, id: string): Promise<Account | null>;
  create(userId: string, input: TransactionInput): Promise<TransactionRecord>;
  list(userId: string): Promise<TransactionRecord[]>;
  update(userId: string, id: string, input: TransactionInput): Promise<TransactionRecord | null>;
  remove(userId: string, id: string): Promise<boolean>;
}
const fail = (message: string): never => { throw new Error(message); };
function validAmount(value: number, name: string) { if (!Number.isSafeInteger(value) || value < 0) fail(`${name} must be a non-negative integer`); }
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
async function validate(repository: TransactionRepository, userId: string, input: TransactionInput): Promise<TransactionInput> {
  validAmount(input.amount, "amount"); validAmount(input.baseAmount, "baseAmount"); validCurrency(input);
  if (Number.isNaN(Date.parse(input.transactionAt))) fail("transactionAt must be an ISO timestamp");
  if (input.type === "TRANSFER") {
    if (!input.fromAccountId || !input.toAccountId || input.fromAccountId === input.toAccountId) fail("TRANSFER requires distinct source and destination accounts");
    return { ...input, accountId: undefined, fromAccountId: await active(repository, userId, input.fromAccountId), toAccountId: await active(repository, userId, input.toAccountId) };
  }
  return { ...input, accountId: await active(repository, userId, input.accountId), fromAccountId: undefined, toAccountId: undefined };
}
export function createTransactionService(repository: TransactionRepository) { return {
  list: (userId: string) => repository.list(userId),
  create: async (userId: string, input: TransactionInput) => repository.create(userId, await validate(repository, userId, input)),
  update: async (userId: string, id: string, input: TransactionInput) => { const row = await repository.update(userId, id, await validate(repository, userId, input)); if (!row) fail("transaction not found"); return row; },
  remove: async (userId: string, id: string) => { if (!await repository.remove(userId, id)) fail("transaction not found"); },
}; }
