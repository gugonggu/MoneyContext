export type NetWorthInput = Readonly<{ liquidAssets: number; liabilities: number; creditCardOutstanding: number }>;

export function calculateNetWorth({ liquidAssets, liabilities, creditCardOutstanding }: NetWorthInput): number {
  return liquidAssets - liabilities - creditCardOutstanding;
}
