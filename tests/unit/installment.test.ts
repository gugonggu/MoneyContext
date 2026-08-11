import { expect, it } from "vitest";
import { createInstallmentSchedule, splitInstallmentPrincipal } from "@/domain/cards/installments";

it("allocates installment remainders deterministically", () => {
  expect(splitInstallmentPrincipal(1_000, 3)).toEqual([334, 333, 333]);
});

it("builds a payment schedule with month-end clamped dates", () => {
  expect(
    createInstallmentSchedule({ totalAmount: 1_000, installmentCount: 3, firstPaymentDate: "2026-01-31" })
  ).toEqual([
    { sequence: 1, scheduledDate: "2026-01-31", principalAmount: 334, feeAmount: 0 },
    { sequence: 2, scheduledDate: "2026-02-28", principalAmount: 333, feeAmount: 0 },
    { sequence: 3, scheduledDate: "2026-03-31", principalAmount: 333, feeAmount: 0 },
  ]);
});

it("rejects feeAmounts that do not match installmentCount", () => {
  expect(() =>
    createInstallmentSchedule({ totalAmount: 100, installmentCount: 2, firstPaymentDate: "2026-01-01", feeAmounts: [1] })
  ).toThrow("feeAmounts must match installmentCount");
});
