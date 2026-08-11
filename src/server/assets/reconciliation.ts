import "server-only";

export type ReconciliationAccount = Readonly<{ id: string; userId: string; isActive: boolean }>;
export type ReconciliationInput = Readonly<{ accountId: string; actualBalance: number; transactionAt: string }>;
export type ReconciliationResult = Readonly<{ created: boolean; difference: number }>;

export interface ReconciliationRepository {
  findAccount(userId: string, accountId: string): Promise<ReconciliationAccount | null>;
  getCalculatedBalance(userId: string, accountId: string): Promise<number>;
}

export interface AdjustmentTransactionCreator {
  create(userId: string, input: Readonly<{
    type: "ADJUSTMENT";
    amount: number;
    baseAmount: number;
    currency: "KRW";
    transactionAt: string;
    accountId: string;
    memo: string;
  }>): Promise<unknown>;
}

export function createReconciliationService(repository: ReconciliationRepository, transactions: AdjustmentTransactionCreator) {
  return {
    async reconcileAccount(userId: string, input: ReconciliationInput): Promise<ReconciliationResult> {
      if (!Number.isSafeInteger(input.actualBalance)) throw new Error("actualBalance must be a safe integer");
      if (Number.isNaN(Date.parse(input.transactionAt))) throw new Error("transactionAt must be an ISO timestamp");

      const account = await repository.findAccount(userId, input.accountId);
      if (!account || !account.isActive || account.userId !== userId) {
        throw new Error("account must be an active account owned by the current user");
      }

      const calculatedBalance = await repository.getCalculatedBalance(userId, account.id);
      const difference = input.actualBalance - calculatedBalance;
      if (difference === 0) return { created: false, difference };

      await transactions.create(userId, {
        type: "ADJUSTMENT",
        amount: difference,
        baseAmount: difference,
        currency: "KRW",
        transactionAt: input.transactionAt,
        accountId: account.id,
        memo: "Balance reconciliation",
      });
      return { created: true, difference };
    },
  };
}
