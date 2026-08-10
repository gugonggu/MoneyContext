export type Krw = number;

function assertSafeInteger(value: number): asserts value is Krw {
  if (!Number.isSafeInteger(value)) throw new RangeError("KRW amounts must be safe integers");
}

export function addMoney(left: Krw, right: Krw): Krw {
  const result = left + right;
  assertSafeInteger(result);
  return result;
}

export function subtractMoney(left: Krw, right: Krw): Krw {
  const result = left - right;
  assertSafeInteger(result);
  return result;
}

export function formatKrw(amount: Krw): string {
  assertSafeInteger(amount);
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(amount);
}
