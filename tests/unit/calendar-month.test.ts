import { describe, expect, it } from "vitest";

import {
  aggregateDailyTotals,
  buildCalendarMonth,
  buildMonthGrid,
  gridRange,
  heatLevels,
  parseYearMonth,
} from "@/domain/calendar/month";

const NO_UPCOMING = new Map();

describe("buildMonthGrid", () => {
  it("always returns 42 cells", () => {
    expect(buildMonthGrid(2026, 8, "2026-08-12")).toHaveLength(42);
    expect(buildMonthGrid(2026, 2, "2026-08-12")).toHaveLength(42);
  });

  it("starts on the Sunday on or before the first of the month", () => {
    expect(buildMonthGrid(2026, 8, "2026-08-12")[0].date).toBe("2026-07-26");
  });

  it("starts on the first when the month opens on a Sunday", () => {
    expect(buildMonthGrid(2026, 11, "2026-11-05")[0].date).toBe("2026-11-01");
  });

  it("flags neighbour-month days as outside the current month", () => {
    const grid = buildMonthGrid(2026, 8, "2026-08-12");

    expect(grid[0].inCurrentMonth).toBe(false);
    expect(grid.find((cell) => cell.date === "2026-08-01")?.inCurrentMonth).toBe(true);
    expect(grid.find((cell) => cell.date === "2026-08-31")?.inCurrentMonth).toBe(true);
    expect(grid[41].inCurrentMonth).toBe(false);
  });

  it("covers every day of a 29-day February", () => {
    const grid = buildMonthGrid(2028, 2, "2028-02-10");

    expect(grid.some((cell) => cell.date === "2028-02-29")).toBe(true);
    expect(grid.some((cell) => cell.date === "2028-03-01")).toBe(true);
  });

  it("crosses the December to January boundary", () => {
    const grid = buildMonthGrid(2026, 12, "2026-12-10");

    expect(grid.some((cell) => cell.date === "2026-12-31")).toBe(true);
    expect(grid.some((cell) => cell.date.startsWith("2027-01"))).toBe(true);
  });

  it("preserves years 0000 through 9999 without the Date 1900 offset", () => {
    expect(buildMonthGrid(0, 8, "0000-08-01")[0].date).toBe("0000-07-30");
    expect(buildMonthGrid(99, 8, "0099-08-01")[0].date).toBe("0099-07-26");
    expect(buildMonthGrid(9999, 8, "9999-08-01").at(-1)?.date).toBe("9999-09-11");
  });

  it("marks today", () => {
    const grid = buildMonthGrid(2026, 8, "2026-08-12");

    expect(grid.filter((cell) => cell.isToday)).toHaveLength(1);
    expect(grid.find((cell) => cell.isToday)?.date).toBe("2026-08-12");
  });

  it("assigns Sunday to weekday 0 and Saturday to weekday 6", () => {
    const grid = buildMonthGrid(2026, 8, "2026-08-12");

    expect(grid[0].weekday).toBe(0);
    expect(grid[6].weekday).toBe(6);
  });
});

describe("gridRange", () => {
  it("reports the first and last date of the 42-cell grid", () => {
    expect(gridRange(2026, 8)).toEqual({ start: "2026-07-26", end: "2026-09-05" });
  });
});

describe("aggregateDailyTotals", () => {
  const base = { currency: "KRW", memo: undefined, categoryName: undefined, accountName: undefined };

  it("sums income and expense per Seoul day", () => {
    const totals = aggregateDailyTotals([
      { ...base, id: "1", type: "EXPENSE", status: "CONFIRMED", transactionAt: "2026-08-05T03:00:00Z", baseAmount: 12_000 },
      { ...base, id: "2", type: "EXPENSE", status: "CONFIRMED", transactionAt: "2026-08-05T05:00:00Z", baseAmount: 8_000 },
      { ...base, id: "3", type: "INCOME", status: "CONFIRMED", transactionAt: "2026-08-05T06:00:00Z", baseAmount: 2_500_000 },
    ]);

    expect(totals.get("2026-08-05")).toEqual({ income: 2_500_000, expense: 20_000 });
  });

  it("excludes transfers because a transfer is neither income nor expense", () => {
    const totals = aggregateDailyTotals([
      { ...base, id: "1", type: "TRANSFER", status: "CONFIRMED", transactionAt: "2026-08-05T03:00:00Z", baseAmount: 500_000 },
    ]);

    expect(totals.get("2026-08-05")).toBeUndefined();
  });

  it("excludes balance adjustments from income and expense", () => {
    const totals = aggregateDailyTotals([
      { ...base, id: "1", type: "ADJUSTMENT", status: "CONFIRMED", transactionAt: "2026-08-05T03:00:00Z", baseAmount: 30_000 },
    ]);

    expect(totals.get("2026-08-05")).toBeUndefined();
  });

  it("excludes pending and cancelled transactions", () => {
    const totals = aggregateDailyTotals([
      { ...base, id: "1", type: "EXPENSE", status: "PENDING", transactionAt: "2026-08-05T03:00:00Z", baseAmount: 10_000 },
      { ...base, id: "2", type: "EXPENSE", status: "CANCELLED", transactionAt: "2026-08-05T03:00:00Z", baseAmount: 10_000 },
    ]);

    expect(totals.get("2026-08-05")).toBeUndefined();
  });

  it("uses baseAmount so a foreign-currency purchase counts in KRW", () => {
    const totals = aggregateDailyTotals([
      { ...base, id: "1", type: "EXPENSE", status: "CONFIRMED", currency: "USD", transactionAt: "2026-08-05T03:00:00Z", baseAmount: 137_000 },
    ]);

    expect(totals.get("2026-08-05")?.expense).toBe(137_000);
  });

  it("assigns a late-UTC transaction to the next Seoul day", () => {
    const totals = aggregateDailyTotals([
      { ...base, id: "1", type: "EXPENSE", status: "CONFIRMED", transactionAt: "2026-08-05T15:30:00Z", baseAmount: 9_000 },
    ]);

    expect(totals.get("2026-08-05")).toBeUndefined();
    expect(totals.get("2026-08-06")?.expense).toBe(9_000);
  });
});

describe("heatLevels", () => {
  it("keeps ordinary days above level 0 even when one outlier dwarfs them", () => {
    const levels = heatLevels(
      new Map([
        ["d1", 10_000],
        ["d2", 20_000],
        ["d3", 30_000],
        ["d4", 40_000],
        ["d5", 2_000_000],
      ]),
    );

    for (const key of ["d1", "d2", "d3", "d4"]) {
      expect(levels.get(key)).toBeGreaterThan(0);
    }
    expect(levels.get("d5")).toBe(4);
  });

  it("gives a zero-spend day level 0", () => {
    const levels = heatLevels(new Map([["d1", 0], ["d2", 50_000]]));

    expect(levels.get("d1")).toBe(0);
  });

  it("returns level 0 everywhere when nothing was spent", () => {
    const levels = heatLevels(new Map([["d1", 0], ["d2", 0]]));

    expect(levels.get("d1")).toBe(0);
    expect(levels.get("d2")).toBe(0);
  });

  it("gives a single spending day the top level", () => {
    expect(heatLevels(new Map([["d1", 5_000]])).get("d1")).toBe(4);
  });
});

describe("parseYearMonth", () => {
  it("reads a well-formed value", () => {
    expect(parseYearMonth("2026-08", "2026-11-20")).toEqual({ year: 2026, month: 8 });
  });

  it("falls back to the reference month when the value is missing", () => {
    expect(parseYearMonth(undefined, "2026-11-20")).toEqual({ year: 2026, month: 11 });
  });

  it("falls back when the month is out of range", () => {
    expect(parseYearMonth("2026-13", "2026-11-20")).toEqual({ year: 2026, month: 11 });
  });

  it("falls back when the year is outside the calendar service range", () => {
    expect(parseYearMonth("1969-12", "2026-11-20")).toEqual({ year: 2026, month: 11 });
    expect(parseYearMonth("10000-01", "2026-11-20")).toEqual({ year: 2026, month: 11 });
  });

  it("falls back on a malformed value", () => {
    expect(parseYearMonth("아무거나", "2026-11-20")).toEqual({ year: 2026, month: 11 });
  });
});

describe("buildCalendarMonth", () => {
  const transactions = [
    { id: "1", type: "EXPENSE" as const, status: "CONFIRMED" as const, transactionAt: "2026-08-05T03:00:00Z", baseAmount: 47_000, memo: "점심", categoryName: "식비", accountName: "국민카드" },
    { id: "2", type: "INCOME" as const, status: "CONFIRMED" as const, transactionAt: "2026-08-25T01:00:00Z", baseAmount: 2_500_000, memo: "급여", categoryName: "급여", accountName: "주거래" },
    { id: "3", type: "TRANSFER" as const, status: "CONFIRMED" as const, transactionAt: "2026-08-10T01:00:00Z", baseAmount: 300_000 },
  ];

  it("summarises only the current month, excluding transfers", () => {
    const month = buildCalendarMonth({ year: 2026, month: 8, today: "2026-08-12", transactions, upcoming: NO_UPCOMING });

    expect(month.summary).toEqual({ income: 2_500_000, expense: 47_000, net: 2_453_000 });
  });

  it("attaches transactions to their own cell", () => {
    const month = buildCalendarMonth({ year: 2026, month: 8, today: "2026-08-12", transactions, upcoming: NO_UPCOMING });
    const cell = month.cells.find((item) => item.date === "2026-08-05");

    expect(cell?.expense).toBe(47_000);
    expect(cell?.transactions.map((item) => item.memo)).toEqual(["점심"]);
  });

  it("leaves transfer-only days empty", () => {
    const month = buildCalendarMonth({ year: 2026, month: 8, today: "2026-08-12", transactions, upcoming: NO_UPCOMING });
    const cell = month.cells.find((item) => item.date === "2026-08-10");

    expect(cell?.income).toBe(0);
    expect(cell?.expense).toBe(0);
    expect(cell?.transactions).toHaveLength(0);
  });

  it("keeps upcoming markers out of the totals", () => {
    const upcoming = new Map([
      ["2026-08-12", [{ kind: "PLANNED" as const, label: "예정 지출", amount: 30_000, direction: "EXPENSE" as const }]],
    ]);
    const month = buildCalendarMonth({ year: 2026, month: 8, today: "2026-08-12", transactions, upcoming });
    const cell = month.cells.find((item) => item.date === "2026-08-12");

    expect(cell?.upcoming).toHaveLength(1);
    expect(cell?.expense).toBe(0);
    expect(month.summary.expense).toBe(47_000);
  });

  it("excludes neighbour-month days from the summary", () => {
    const withNeighbour = [
      ...transactions,
      { id: "4", type: "EXPENSE" as const, status: "CONFIRMED" as const, transactionAt: "2026-07-28T03:00:00Z", baseAmount: 99_000 },
    ];
    const month = buildCalendarMonth({ year: 2026, month: 8, today: "2026-08-12", transactions: withNeighbour, upcoming: NO_UPCOMING });

    expect(month.cells.find((item) => item.date === "2026-07-28")?.expense).toBe(99_000);
    expect(month.summary.expense).toBe(47_000);
  });

  it("calculates heat levels from current-month spending only", () => {
    const month = buildCalendarMonth({
      year: 2026,
      month: 8,
      today: "2026-08-12",
      transactions: [
        { id: "august", type: "EXPENSE", status: "CONFIRMED", transactionAt: "2026-08-05T03:00:00Z", baseAmount: 10_000 },
        { id: "july", type: "EXPENSE", status: "CONFIRMED", transactionAt: "2026-07-28T03:00:00Z", baseAmount: 1_000_000 },
      ],
      upcoming: NO_UPCOMING,
    });

    expect(month.cells.find((item) => item.date === "2026-08-05")?.heatLevel).toBe(4);
  });
});
