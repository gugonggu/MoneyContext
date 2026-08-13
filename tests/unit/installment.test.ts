import { expect, it } from "vitest";
import { calculateInstallmentPaymentAmount, createInstallmentSchedule, splitInstallmentPrincipal, suggestFirstInstallmentPaymentDate } from "@/domain/cards/installments";

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

it("adds principal and fee for the displayed installment cashflow", () => {
  expect(calculateInstallmentPaymentAmount(250_000, 10_000)).toBe(260_000);
});

it("suggests this cycle's payment day when the purchase is made before it", () => {
  expect(suggestFirstInstallmentPaymentDate("2026-08-05", 14)).toBe("2026-08-14");
});

it("suggests next month's payment day when the purchase is made after it", () => {
  expect(suggestFirstInstallmentPaymentDate("2026-08-20", 14)).toBe("2026-09-14");
});

it("clamps to the last day of a short month when the payment day doesn't exist in it", () => {
  expect(suggestFirstInstallmentPaymentDate("2026-01-30", 31)).toBe("2026-01-31");
  expect(suggestFirstInstallmentPaymentDate("2026-02-20", 31)).toBe("2026-02-28");
});

it("pushes the suggestion past a card's first payment date for a card issued mid-cycle", () => {
  // Card issued in August with a payment day of 14; purchased before the 14th
  // would naturally suggest 2026-08-14, but the card's first real bill isn't
  // until September.
  expect(suggestFirstInstallmentPaymentDate("2026-08-05", 14, "2026-09-14")).toBe("2026-09-14");
});

it("does not push the suggestion forward when it already falls on or after the card's first payment date", () => {
  expect(suggestFirstInstallmentPaymentDate("2026-10-05", 14, "2026-09-14")).toBe("2026-10-14");
});
