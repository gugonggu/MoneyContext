import { expect, it } from "vitest";
import { calculateNetWorth } from "@/domain/accounts/net-worth";

it("subtracts liabilities and credit card outstanding from liquid assets", () => {
  expect(calculateNetWorth({ liquidAssets: 1_000_000, liabilities: 500_000, creditCardOutstanding: 100_000 })).toBe(400_000);
});
