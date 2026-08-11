export type ExportPeriod = Readonly<{ startDate: string; endDate: string }>;

export type ExportPeriodInput =
  | Readonly<{ kind: "RECENT"; months: 1 | 3 | 6 }>
  | Readonly<{ kind: "MONTH"; month: string }>
  | Readonly<{ kind: "CUSTOM"; startDate: string; endDate: string }>;

function seoulMonth(now: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const part = (type: "year" | "month") => Number(parts.find((item) => item.type === type)?.value);
  return { year: part("year"), month: part("month") };
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function monthRange(year: number, month: number): ExportPeriod {
  const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startDate: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`,
    endDate: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`,
  };
}

function parseMonth(value: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError("month must use YYYY-MM format");
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new RangeError("month must be between 01 and 12");
  return { year, month };
}

function shiftMonth(year: number, month: number, amount: number): { year: number; month: number } {
  const monthIndex = year * 12 + month - 1 + amount;
  return { year: Math.floor(monthIndex / 12), month: (monthIndex % 12) + 1 };
}

export function resolveExportPeriod(input: ExportPeriodInput | undefined, now = new Date()): ExportPeriod {
  const selection = input ?? { kind: "RECENT", months: 1 as const };
  if (selection.kind === "RECENT") {
    if (selection.months !== 1 && selection.months !== 3 && selection.months !== 6) {
      throw new RangeError("recent export period must be 1, 3, or 6 months");
    }
    const current = seoulMonth(now);
    const start = shiftMonth(current.year, current.month, -(selection.months - 1));
    return { startDate: monthRange(start.year, start.month).startDate, endDate: monthRange(current.year, current.month).endDate };
  }
  if (selection.kind === "MONTH") {
    const month = parseMonth(selection.month);
    return monthRange(month.year, month.month);
  }
  if (!isCalendarDate(selection.startDate) || !isCalendarDate(selection.endDate)) {
    throw new RangeError("custom export dates must be calendar dates in YYYY-MM-DD format");
  }
  if (selection.startDate > selection.endDate) throw new RangeError("custom export start date cannot be after end date");
  return { startDate: selection.startDate, endDate: selection.endDate };
}
