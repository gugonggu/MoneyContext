const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type RecurrenceDateInput = {
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  intervalCount: number;
  dayOfMonth?: number;
  occurrenceDate: string;
};

export function nextOccurrenceDate(input: RecurrenceDateInput): string {
  assertIsoDate(input.occurrenceDate);
  assertPositiveInteger(input.intervalCount, "intervalCount");

  if (input.frequency === "DAILY") return addUtcDays(input.occurrenceDate, input.intervalCount);
  if (input.frequency === "WEEKLY") return addUtcDays(input.occurrenceDate, input.intervalCount * 7);

  assertDayOfMonth(input.dayOfMonth);
  return monthDateWithClamp(input.occurrenceDate, input.intervalCount, input.dayOfMonth);
}

export const isDueOnOrBefore = (nextRunDate: string, today: string): boolean => nextRunDate <= today;

function assertIsoDate(value: string): void {
  if (!ISO_DATE.test(value)) throw new RangeError("date must be YYYY-MM-DD");

  const [year, month, day] = value.split("-").map(Number);
  const date = utcDate(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new RangeError("date must be a valid YYYY-MM-DD date");
  }
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) throw new RangeError(`${name} must be a positive integer`);
}

function assertDayOfMonth(value: number | undefined): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 31) {
    throw new RangeError("dayOfMonth must be between 1 and 31");
  }
}

function addUtcDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = utcDate(year, month - 1, day);
  date.setUTCDate(date.getUTCDate() + days);
  return formatUtcDate(date);
}

function monthDateWithClamp(dateString: string, months: number, dayOfMonth: number): string {
  const [year, month] = dateString.split("-").map(Number);
  const targetMonthIndex = month - 1 + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = utcDate(targetYear, targetMonth + 1, 0).getUTCDate();
  return formatUtcDate(utcDate(targetYear, targetMonth, Math.min(dayOfMonth, lastDay)));
}

function utcDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  return date;
}

function formatUtcDate(date: Date): string {
  if (date.getUTCFullYear() < 0 || date.getUTCFullYear() > 9999) {
    throw new RangeError("next occurrence must be within the four-digit year range");
  }
  return date.toISOString().slice(0, 10);
}
