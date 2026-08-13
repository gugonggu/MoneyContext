import { describe, expect, it } from "vitest";
import { calculateCreditCardOutstanding, creditUsageRatio } from "@/domain/cards/outstanding";

it("does not treat card settlement as additional consumption", () => {
  expect(calculateCreditCardOutstanding([{ kind: "PURCHASE", amount: 100_000 }, { kind: "SETTLEMENT", amount: 100_000 }])).toBe(0);
});

describe("creditUsageRatio", () => {
  it("divides the outstanding balance by the total limit", () => {
    // 미결제 30만, 남은 한도 70만 → 총 한도 100만의 30%
    expect(creditUsageRatio(300_000, 700_000)).toBe(0.3);
  });

  it("returns null when the limit is unknown", () => {
    expect(creditUsageRatio(300_000, null)).toBeNull();
  });

  it("returns null when the total limit is zero", () => {
    expect(creditUsageRatio(0, 0)).toBeNull();
  });

  it("reports a fully used card as 1", () => {
    expect(creditUsageRatio(500_000, 0)).toBe(1);
  });
});
