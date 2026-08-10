import { describe, expect, it } from "vitest";
import { calculateAccountBalance, calculateLiquidAssets } from "@/domain/accounts/balance";

describe("account balance", () => {
  it("applies confirmed income and expense", () => {
    expect(calculateAccountBalance(1_000_000, [{ type: "INCOME", amount: 2_000_000 }, { type: "EXPENSE", amount: 300_000 }])).toBe(2_700_000);
  });

  it("keeps internal transfers out of income and expense semantics", () => {
    expect(calculateAccountBalance(1_000_000, [{ type: "TRANSFER_OUT", amount: 300_000 }])).toBe(700_000);
    expect(calculateAccountBalance(200_000, [{ type: "TRANSFER_IN", amount: 300_000 }])).toBe(500_000);
  });

  it("does not double count a debit payment method as an asset", () => {
    expect(calculateLiquidAssets([{ id: "bank", type: "BANK", balance: 900_000 }, { id: "debit", type: "DEBIT", balance: 0, linkedAccountId: "bank" }])).toBe(900_000);
  });
});
