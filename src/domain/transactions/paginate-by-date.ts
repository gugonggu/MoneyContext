import { toSeoulDate } from "@/lib/dates/seoul";

export type DateBoundedRow = Readonly<{ transactionAt: string }>;

export type DateBoundedPage<T> = Readonly<{
  items: readonly T[];
  consumedCount: number;
  hasMore: boolean;
}>;

// Rows are ordered newest-first. A plain offset/limit page can cut a day's
// transactions in half, leaving a duplicate date header (and a split
// income/expense subtotal) on the next page. Given a batch that was fetched
// with some overflow beyond targetSize, extend the page through the rest of
// the boundary day so a day's rows never split across two pages.
export function paginateByDate<T extends DateBoundedRow>(
  rows: readonly T[],
  targetSize: number,
  repositoryHasMore: boolean,
): DateBoundedPage<T> {
  if (rows.length <= targetSize) {
    return { items: rows, consumedCount: rows.length, hasMore: repositoryHasMore };
  }

  const dateOf = (row: T) => toSeoulDate(row.transactionAt);
  const boundaryDate = dateOf(rows[targetSize - 1]);
  let end = targetSize;
  while (end < rows.length && dateOf(rows[end]) === boundaryDate) end += 1;

  return {
    items: rows.slice(0, end),
    consumedCount: end,
    hasMore: end < rows.length || repositoryHasMore,
  };
}
