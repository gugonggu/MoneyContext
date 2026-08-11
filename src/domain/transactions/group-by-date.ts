export type GroupableTransaction = Readonly<{ transactionAt: string }>;
export type DateGroup<T> = Readonly<{ date: string; transactions: readonly T[] }>;

export function groupTransactionsByDate<T extends GroupableTransaction>(transactions: readonly T[]): DateGroup<T>[] {
  const groups = new Map<string, T[]>();

  for (const transaction of transactions) {
    const date = transaction.transactionAt.slice(0, 10);
    const group = groups.get(date);
    if (group) group.push(transaction);
    else groups.set(date, [transaction]);
  }

  return Array.from(groups, ([date, items]) => ({ date, transactions: items }));
}
