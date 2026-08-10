import { describe, expect, it } from "vitest";

import { addMoney, formatKrw, subtractMoney } from "@/domain/money/krw";

describe("KRW money primitives", () => {
  it("adds integer won without floating point arithmetic", () => {
    expect(addMoney(1_000_000, 2_156_880)).toBe(3_156_880);
  });

  it("subtracts integer won", () => {
    expect(subtractMoney(1_000_000, 20_000)).toBe(980_000);
  });

  it("formats KRW for display", () => {
    expect(formatKrw(12_000)).toBe("₩12,000");
  });
});
