import { expect, it } from "vitest";
import { calculateCreditCardOutstanding } from "@/domain/cards/outstanding";

it("does not treat card settlement as additional consumption", () => {
  expect(calculateCreditCardOutstanding([{ kind: "PURCHASE", amount: 100_000 }, { kind: "SETTLEMENT", amount: 100_000 }])).toBe(0);
});
