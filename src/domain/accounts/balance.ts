export type BalanceEvent = Readonly<{ type: "INCOME" | "EXPENSE" | "ADJUSTMENT" | "TRANSFER_IN" | "TRANSFER_OUT"; amount: number }>;

export function calculateAccountBalance(initialBalance: number, events: readonly BalanceEvent[]): number {
  return events.reduce((balance, event) => {
    if (event.type === "INCOME" || event.type === "TRANSFER_IN" || event.type === "ADJUSTMENT") return balance + event.amount;
    return balance - event.amount;
  }, initialBalance);
}

export type AssetAccount = Readonly<{ id: string; type: "BANK" | "CASH" | "DEBIT"; balance: number; linkedAccountId?: string }>;

export function calculateLiquidAssets(accounts: readonly AssetAccount[]): number {
  return accounts.filter((account) => account.type !== "DEBIT").reduce((total, account) => total + account.balance, 0);
}
