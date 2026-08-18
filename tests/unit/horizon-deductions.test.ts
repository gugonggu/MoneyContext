import { describe, expect, it } from "vitest";

import { buildHorizonDeductions, nextCardPaymentDate } from "@/server/export/repository";
import type { AssetOverview } from "@/server/assets/service";

function overviewWithCard(card: AssetOverview["cards"][number]): AssetOverview {
  return {
    liquidAssets: 0,
    liabilities: 0,
    netWorth: 0,
    accounts: { bank: [], cash: [], debit: [], liability: [] },
    cards: [card],
  };
}

describe("nextCardPaymentDate", () => {
  it("clamps paymentDay 31 to the last day of February when today is in February", () => {
    // 2026-02-15 is before the (clamped) payment day, so this cycle's payment
    // date applies - February only has 28 days in 2026 (not a leap year).
    expect(nextCardPaymentDate(31, "2026-02-15")).toBe("2026-02-28");
  });

  it("rolls over to next month when today is after the payment day", () => {
    expect(nextCardPaymentDate(15, "2026-08-20")).toBe("2026-09-15");
  });
});

describe("buildHorizonDeductions", () => {
  it("does not let an interest-bearing installment's fee zero out a real non-installment balance", () => {
    // outstanding = 100,000 non-installment balance + 50,000 installment principal.
    // The scheduled installment payment has a fee on top (principal 50,000 + fee 5,000 = 55,000),
    // but outstanding itself has no fee concept - only principal was ever charged to it.
    // Subtracting the fee-inclusive paymentAmount (55,000) from outstanding (150,000)
    // would wrongly leave only 95,000 instead of the correct 100,000.
    const overview = overviewWithCard({
      id: "card-1",
      name: "신용카드",
      outstanding: 150_000,
      availableLimit: null,
      nextPaymentDate: null,
      paymentAccountId: null,
      paymentDay: 25,
      creditLimit: null,
      firstPaymentDate: null,
      installmentSchedule: [
        {
          id: "inst-1",
          sequence: 1,
          scheduledDate: "2026-09-25",
          principalAmount: 50_000,
          feeAmount: 5_000,
          paymentAmount: 55_000,
          status: "SCHEDULED",
        },
      ],
    });

    const deductions = buildHorizonDeductions(overview, "2026-08-18");

    const nonInstallmentDeduction = deductions.find((deduction) => deduction.provenance === "card:card-1");
    expect(nonInstallmentDeduction?.amount).toBe(100_000);

    const installmentDeduction = deductions.find((deduction) => deduction.provenance === "installment:inst-1");
    expect(installmentDeduction?.amount).toBe(55_000);
  });
});
