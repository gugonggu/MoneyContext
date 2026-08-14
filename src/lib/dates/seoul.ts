const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const SEOUL_UTC_OFFSET_HOURS = 9;

const SEOUL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  era: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const SEOUL_DATETIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  era: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatIsoDate(year: number, month: number, day: number): string {
  if (!Number.isInteger(year) || year < 0 || year > 9999) throw new RangeError("date must be within ISO year range");
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatSeoulDate(instant: Date): string {
  if (Number.isNaN(instant.getTime())) throw new RangeError("timestamp must be parseable");
  const parts = SEOUL_FORMATTER.formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  const eraYear = Number(part("year"));
  const year = part("era") === "BC" ? 1 - eraYear : eraYear;
  return formatIsoDate(year, Number(part("month")), Number(part("day")));
}

function utcDate(year: number, month: number, day: number, hours = 0): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hours, 0, 0, 0);
  return date;
}

export function toSeoulDate(isoTimestamp: string): string {
  return formatSeoulDate(new Date(isoTimestamp));
}

// Converts a UTC instant to the "YYYY-MM-DDTHH:mm" wall-clock string an
// <input type="datetime-local"> expects, using Korea time regardless of the
// server process's own timezone (Vercel runs UTC; local dev may not).
export function utcIsoToSeoulWallClock(isoTimestamp: string): string {
  const instant = new Date(isoTimestamp);
  if (Number.isNaN(instant.getTime())) throw new RangeError("timestamp must be parseable");
  const parts = SEOUL_DATETIME_FORMATTER.formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  const eraYear = Number(part("year"));
  const year = part("era") === "BC" ? 1 - eraYear : eraYear;
  return `${formatIsoDate(year, Number(part("month")), Number(part("day")))}T${part("hour")}:${part("minute")}`;
}

// The inverse: a "YYYY-MM-DDTHH:mm[:ss]" wall-clock string (e.g. straight from
// a datetime-local input) is always Korea time in this app - never the
// server's local timezone - so it must be converted explicitly rather than
// handed to `new Date(...)`, which assumes the runtime's own timezone.
export function seoulWallClockToUtcIso(value: string): string {
  const match = ISO_DATE_TIME.exec(value);
  if (!match) throw new RangeError("datetime must be an ISO-like YYYY-MM-DDTHH:mm[:ss] string");
  const [, year, month, day, hour, minute, second] = match;
  const instant = new Date(0);
  instant.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  instant.setUTCHours(Number(hour) - SEOUL_UTC_OFFSET_HOURS, Number(minute), Number(second ?? "0"), 0);
  return instant.toISOString();
}

export function todayInSeoul(now: Date = new Date()): string {
  return formatSeoulDate(now);
}

export function assertIsoDate(value: string): [number, number, number] {
  if (!ISO_DATE.test(value)) throw new RangeError("date must be YYYY-MM-DD");
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const probe = new Date(0);
  probe.setUTCFullYear(year, month - 1, day);
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new RangeError("date must be a valid YYYY-MM-DD date");
  }
  return [year, month, day];
}

export function seoulDayStartUtcIso(date: string): string {
  const [year, month, day] = assertIsoDate(date);
  return utcDate(year, month, day, -SEOUL_UTC_OFFSET_HOURS).toISOString();
}

export function addIsoDays(date: string, days: number): string {
  const [year, month, day] = assertIsoDate(date);
  const shifted = utcDate(year, month, day);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return formatIsoDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}
