import { addIsoDays, assertIsoDate, toSeoulDate } from "@/lib/dates/seoul";
import { classifyTransferDirection } from "@/domain/transactions/transfer-direction";

import type { CalendarCell, CalendarMonth, CalendarTransaction, HeatLevel, UpcomingMarker } from "./types";

const GRID_CELLS = 42;

export type CalendarDay = Readonly<{
  date: string;
  inCurrentMonth: boolean;
  isToday: boolean;
  weekday: number;
}>;

export type SourceTransaction = Readonly<{
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT";
  status: "CONFIRMED" | "PENDING" | "CANCELLED";
  transactionAt: string;
  baseAmount: number;
  memo?: string;
  categoryName?: string;
  accountName?: string;
  fromAccountId?: string;
  toAccountId?: string;
}>;

export type DailyTotals = Readonly<{ income: number; expense: number }>;

// A TRANSFER with only one side present is money sent to or received from
// outside the tracked accounts (e.g. paying a friend back) - it counts toward
// the day's income/expense same as a real transaction would.
function effectiveType(transaction: SourceTransaction): "INCOME" | "EXPENSE" | undefined {
  if (transaction.type === "INCOME" || transaction.type === "EXPENSE") return transaction.type;
  if (transaction.type === "TRANSFER") return classifyTransferDirection(transaction.fromAccountId, transaction.toAccountId);
  return undefined;
}

function countsTowardTotals(transaction: SourceTransaction): boolean {
  if (transaction.status !== "CONFIRMED") return false;
  return effectiveType(transaction) !== undefined;
}

function firstOfMonth(year: number, month: number): string {
  const date = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
  assertIsoDate(date);
  return date;
}

function weekdayOf(date: string): number {
  const [year, month, day] = assertIsoDate(date);
  const instant = new Date(0);
  instant.setUTCFullYear(year, month - 1, day);
  instant.setUTCHours(0, 0, 0, 0);
  return instant.getUTCDay();
}

export function buildMonthGrid(year: number, month: number, today: string): readonly CalendarDay[] {
  const first = firstOfMonth(year, month);
  const leadingDays = weekdayOf(first);
  const gridStart = addIsoDays(first, -leadingDays);
  const currentYearMonth = first.slice(0, 7);

  return Array.from({ length: GRID_CELLS }, (_, index) => {
    const date = addIsoDays(gridStart, index);
    return {
      date,
      inCurrentMonth: date.startsWith(currentYearMonth),
      isToday: date === today,
      weekday: index % 7,
    };
  });
}

export function gridRange(year: number, month: number): Readonly<{ start: string; end: string }> {
  const grid = buildMonthGrid(year, month, "");
  return { start: grid[0].date, end: grid[GRID_CELLS - 1].date };
}

export function aggregateDailyTotals(
  transactions: readonly SourceTransaction[],
): ReadonlyMap<string, DailyTotals> {
  const totals = new Map<string, { income: number; expense: number }>();

  for (const transaction of transactions) {
    if (!countsTowardTotals(transaction)) continue;
    const date = toSeoulDate(transaction.transactionAt);
    const bucket = totals.get(date) ?? { income: 0, expense: 0 };
    if (effectiveType(transaction) === "INCOME") bucket.income += transaction.baseAmount;
    else bucket.expense += transaction.baseAmount;
    totals.set(date, bucket);
  }

  return totals;
}

export function heatLevels(expenseByDate: ReadonlyMap<string, number>): ReadonlyMap<string, HeatLevel> {
  const levels = new Map<string, HeatLevel>();
  const spending = [...expenseByDate.values()].filter((value) => value > 0).sort((a, b) => a - b);

  if (spending.length === 0) {
    for (const date of expenseByDate.keys()) levels.set(date, 0);
    return levels;
  }

  const quantile = (fraction: number) => spending[Math.min(spending.length - 1, Math.floor(fraction * spending.length))];
  const [q1, q2, q3] = [quantile(0.25), quantile(0.5), quantile(0.75)];

  for (const [date, value] of expenseByDate) {
    if (value <= 0) levels.set(date, 0);
    else if (value < q1) levels.set(date, 1);
    else if (value < q2) levels.set(date, 2);
    else if (value < q3) levels.set(date, 3);
    else levels.set(date, 4);
  }

  return levels;
}

const YEAR_MONTH = /^(\d{4})-(\d{2})$/;

export function parseYearMonth(
  value: string | undefined,
  referenceDate: string,
): Readonly<{ year: number; month: number }> {
  const match = value ? YEAR_MONTH.exec(value) : null;
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (year >= 1970 && year <= 9999 && month >= 1 && month <= 12) return { year, month };
  }
  const [year, month] = assertIsoDate(referenceDate);
  return { year, month };
}

export function buildCalendarMonth(
  input: Readonly<{
    year: number;
    month: number;
    today: string;
    transactions: readonly SourceTransaction[];
    upcoming: ReadonlyMap<string, readonly UpcomingMarker[]>;
  }>,
): CalendarMonth {
  const grid = buildMonthGrid(input.year, input.month, input.today);
  const totals = aggregateDailyTotals(input.transactions);
  const currentMonthDates = new Set(grid.filter((day) => day.inCurrentMonth).map((day) => day.date));
  const levels = heatLevels(
    new Map(
      [...totals]
        .filter(([date]) => currentMonthDates.has(date))
        .map(([date, value]) => [date, value.expense]),
    ),
  );

  const byDate = new Map<string, CalendarTransaction[]>();
  for (const transaction of input.transactions) {
    if (!countsTowardTotals(transaction)) continue;
    const date = toSeoulDate(transaction.transactionAt);
    const bucket = byDate.get(date) ?? [];
    bucket.push({
      id: transaction.id,
      type: effectiveType(transaction) === "INCOME" ? "INCOME" : "EXPENSE",
      baseAmount: transaction.baseAmount,
      memo: transaction.memo,
      categoryName: transaction.categoryName,
      accountName: transaction.accountName,
    });
    byDate.set(date, bucket);
  }

  const cells: CalendarCell[] = grid.map((day) => {
    const dayTotals = totals.get(day.date) ?? { income: 0, expense: 0 };
    return {
      ...day,
      income: dayTotals.income,
      expense: dayTotals.expense,
      heatLevel: levels.get(day.date) ?? 0,
      transactions: byDate.get(day.date) ?? [],
      upcoming: input.upcoming.get(day.date) ?? [],
    };
  });

  let income = 0;
  let expense = 0;
  for (const cell of cells) {
    if (!cell.inCurrentMonth) continue;
    income += cell.income;
    expense += cell.expense;
  }

  return {
    year: input.year,
    month: input.month,
    cells,
    summary: { income, expense, net: income - expense },
  };
}
