export type CardOutstandingEvent = Readonly<{ kind: "PURCHASE" | "SETTLEMENT"; amount: number }>;

export function calculateCreditCardOutstanding(events: readonly CardOutstandingEvent[]): number {
  return events.reduce((outstanding, event) => event.kind === "PURCHASE" ? outstanding + event.amount : outstanding - event.amount, 0);
}

/**
 * 카드 한도 사용률(0..1). availableLimit이 null이면 한도를 모르므로 null을 반환한다.
 * 금융 수치를 모른다는 사실을 0으로 조용히 대체하지 않는다 (UI_UX.md 13항).
 */
export function creditUsageRatio(outstanding: number, availableLimit: number | null): number | null {
  if (availableLimit === null) return null;
  const total = outstanding + availableLimit;
  if (total <= 0) return null;
  return outstanding / total;
}
