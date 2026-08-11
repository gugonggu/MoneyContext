export type PatternTransaction = Readonly<{
  accountId: string;
  categoryId?: string;
  occurredAt: string;
}>;

export type RankedOption = Readonly<{ key: string; score: number }>;

const MILLISECONDS_PER_DAY = 86_400_000;

function daysSince(referenceDate: string, occurredAt: string): number {
  const reference = Date.parse(referenceDate);
  const occurred = Date.parse(occurredAt);
  if (Number.isNaN(reference) || Number.isNaN(occurred)) throw new RangeError("referenceDate and occurredAt must be valid dates");
  return Math.floor((reference - occurred) / MILLISECONDS_PER_DAY);
}

function recencyWeight(days: number): number {
  return 1 / (1 + days);
}

function rankByKey(
  transactions: readonly PatternTransaction[],
  keyOf: (transaction: PatternTransaction) => string | undefined,
  referenceDate: string,
  limit: number,
): RankedOption[] {
  const scores = new Map<string, number>();

  for (const transaction of transactions) {
    const key = keyOf(transaction);
    if (!key) continue;

    const days = daysSince(referenceDate, transaction.occurredAt);
    if (days < 0) continue;

    scores.set(key, (scores.get(key) ?? 0) + recencyWeight(days));
  }

  return Array.from(scores, ([key, score]) => ({ key, score }))
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
    .slice(0, limit);
}

export function rankRecentAccounts(
  transactions: readonly PatternTransaction[],
  referenceDate: string,
  limit = 3,
): RankedOption[] {
  return rankByKey(transactions, (transaction) => transaction.accountId, referenceDate, limit);
}

export function rankFrequentCategories(
  transactions: readonly PatternTransaction[],
  referenceDate: string,
  limit = 3,
): RankedOption[] {
  return rankByKey(transactions, (transaction) => transaction.categoryId, referenceDate, limit);
}

export function rankFrequentCategoryAccountCombos(
  transactions: readonly PatternTransaction[],
  referenceDate: string,
  limit = 3,
): RankedOption[] {
  return rankByKey(
    transactions,
    (transaction) => (transaction.categoryId ? `${transaction.categoryId}:${transaction.accountId}` : undefined),
    referenceDate,
    limit,
  );
}
