import { assertIsoDate } from "@/lib/dates/seoul";

export function parseDefaultTransactionDate(value: string | undefined): string | undefined {
  if (!value) return undefined;

  try {
    assertIsoDate(value);
    return value;
  } catch {
    return undefined;
  }
}
