export type CardOutstandingEvent = Readonly<{ kind: "PURCHASE" | "SETTLEMENT"; amount: number }>;

export function calculateCreditCardOutstanding(events: readonly CardOutstandingEvent[]): number {
  return events.reduce((outstanding, event) => event.kind === "PURCHASE" ? outstanding + event.amount : outstanding - event.amount, 0);
}
