import "server-only";

export type InstallmentPurchaseInput = Readonly<{
  accountId: string;
  categoryId?: string;
  transactionAt: string;
  amount: number;
  currency: string;
  memo?: string;
  installmentCount: number;
  interestType: "INTEREST_FREE" | "INTEREST_BEARING";
  firstPaymentDate: string;
  feeAmounts?: number[];
}>;

export type InstallmentSettlementInput = Readonly<{
  paymentId: string;
  paymentAccountId: string;
  transactionAt: string;
}>;

export type OwnedActiveAccount = Readonly<{ id: string; userId: string; isActive: boolean; type: string }>;
export type ValidInstallmentPurchaseInput = InstallmentPurchaseInput;
export type ValidInstallmentSettlementInput = InstallmentSettlementInput;

export interface InstallmentRepository {
  findAccount(userId: string, id: string): Promise<OwnedActiveAccount | null>;
  createPurchase(userId: string, input: ValidInstallmentPurchaseInput): Promise<{ planId: string }>;
  settlePayment(userId: string, input: ValidInstallmentSettlementInput): Promise<{ transferId: string }>;
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

function assertValidTimestamp(value: string, name: string): void {
  if (Number.isNaN(new Date(value).getTime())) fail(`${name} must be a valid timestamp`);
}

async function validatePurchase(
  repository: InstallmentRepository,
  userId: string,
  input: InstallmentPurchaseInput,
): Promise<ValidInstallmentPurchaseInput> {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) fail("amount must be a positive safe integer");
  if (input.currency !== "KRW") fail("installment purchase currency must be KRW");
  if (!Number.isInteger(input.installmentCount) || input.installmentCount < 2) {
    fail("installmentCount must be an integer greater than 1");
  }
  if (input.interestType !== "INTEREST_FREE" && input.interestType !== "INTEREST_BEARING") fail("interestType is invalid");
  assertValidTimestamp(input.transactionAt, "transactionAt");
  assertValidIsoDate(input.firstPaymentDate, "firstPaymentDate");

  const account = await repository.findAccount(userId, input.accountId);
  if (!account || account.userId !== userId || !account.isActive || account.type !== "CREDIT_CARD") {
    fail("accountId must be an active CREDIT_CARD account owned by the current user");
  }

  return input;
}

async function validateSettlement(
  repository: InstallmentRepository,
  userId: string,
  input: InstallmentSettlementInput,
): Promise<ValidInstallmentSettlementInput> {
  assertValidTimestamp(input.transactionAt, "transactionAt");

  const account = await repository.findAccount(userId, input.paymentAccountId);
  if (!account || account.userId !== userId || !account.isActive || (account.type !== "BANK" && account.type !== "CASH")) {
    fail("paymentAccountId must be an active BANK or CASH account owned by the current user");
  }

  return input;
}

export function createInstallmentService(repository: InstallmentRepository) {
  return {
    createPurchase: async (userId: string, input: InstallmentPurchaseInput) =>
      repository.createPurchase(userId, await validatePurchase(repository, userId, input)),
    settlePayment: async (userId: string, input: InstallmentSettlementInput) =>
      repository.settlePayment(userId, await validateSettlement(repository, userId, input)),
  };
}
