/**
 * A TRANSFER with only one side present is money sent to or received from
 * outside the tracked accounts (e.g. paying a friend back) - it behaves like a
 * real EXPENSE/INCOME. A TRANSFER with both sides (or neither) is between two
 * of the user's own accounts, or otherwise not attributable, and stays
 * excluded (net-worth neutral). Works with either account ids or account
 * names - callers just need a truthy/falsy value per side.
 */
export function classifyTransferDirection(from: unknown, to: unknown): "INCOME" | "EXPENSE" | undefined {
  if (from && !to) return "EXPENSE";
  if (to && !from) return "INCOME";
  return undefined;
}
