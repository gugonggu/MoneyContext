const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SEOUL_UTC_OFFSET_HOURS = 9;

const SEOUL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatSeoulDate(instant: Date): string {
  if (Number.isNaN(instant.getTime())) throw new RangeError("timestamp must be parseable");
  const parts = SEOUL_FORMATTER.formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function toSeoulDate(isoTimestamp: string): string {
  return formatSeoulDate(new Date(isoTimestamp));
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
  return new Date(Date.UTC(year, month - 1, day, -SEOUL_UTC_OFFSET_HOURS)).toISOString();
}

export function addIsoDays(date: string, days: number): string {
  const [year, month, day] = assertIsoDate(date);
  const shifted = new Date(Date.UTC(year, month - 1, day));
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}
