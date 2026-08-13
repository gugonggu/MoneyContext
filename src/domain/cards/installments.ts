import { nextOccurrenceDate } from "@/domain/recurring/schedule";

export function splitInstallmentPrincipal(totalAmount: number, installmentCount: number): number[] {
  if (!Number.isSafeInteger(totalAmount) || totalAmount < 0 || !Number.isInteger(installmentCount) || installmentCount < 2) throw new RangeError("invalid installment input");
  const base = Math.floor(totalAmount / installmentCount);
  const remainder = totalAmount % installmentCount;
  return Array.from({ length: installmentCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

export type InstallmentScheduleInput = {
  totalAmount: number;
  installmentCount: number;
  firstPaymentDate: string;
  feeAmounts?: number[];
};

export type InstallmentPaymentSchedule = {
  sequence: number;
  scheduledDate: string;
  principalAmount: number;
  feeAmount: number;
};

export function calculateInstallmentPaymentAmount(principalAmount: number, feeAmount: number): number {
  return principalAmount + feeAmount;
}

function lastDayOfMonth(year: number, month: number): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month, 0);
  return date.getUTCDate();
}

/**
 * A card bills a purchase on its own payment day, not the day you bought it -
 * a purchase made after this cycle's payment day bills next month instead.
 * If the card only started billing from a later date (e.g. it was just
 * issued), the suggestion is pushed forward to on/after that date too.
 */
export function suggestFirstInstallmentPaymentDate(
  purchaseDate: string,
  paymentDay: number,
  cardFirstPaymentDate?: string | null,
): string {
  const [year, month, day] = purchaseDate.split("-").map(Number);
  const sameMonthDay = Math.min(paymentDay, lastDayOfMonth(year, month));
  const sameMonthCandidate = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(sameMonthDay).padStart(2, "0")}`;

  let candidate = day <= paymentDay
    ? sameMonthCandidate
    : nextOccurrenceDate({ frequency: "MONTHLY", intervalCount: 1, dayOfMonth: paymentDay, occurrenceDate: sameMonthCandidate });

  while (cardFirstPaymentDate && candidate < cardFirstPaymentDate) {
    candidate = nextOccurrenceDate({ frequency: "MONTHLY", intervalCount: 1, dayOfMonth: paymentDay, occurrenceDate: candidate });
  }

  return candidate;
}

export function createInstallmentSchedule(input: InstallmentScheduleInput): InstallmentPaymentSchedule[] {
  const { totalAmount, installmentCount, firstPaymentDate, feeAmounts } = input;
  if (feeAmounts && feeAmounts.length !== installmentCount) throw new RangeError("feeAmounts must match installmentCount");
  if (feeAmounts) {
    for (const fee of feeAmounts) {
      if (!Number.isSafeInteger(fee) || fee < 0) throw new RangeError("feeAmounts must be safe non-negative integers");
    }
  }

  const principalAmounts = splitInstallmentPrincipal(totalAmount, installmentCount);
  const dayOfMonth = Number(firstPaymentDate.slice(8, 10));

  let scheduledDate = firstPaymentDate;
  return principalAmounts.map((principalAmount, index) => {
    if (index > 0) {
      scheduledDate = nextOccurrenceDate({ frequency: "MONTHLY", intervalCount: 1, dayOfMonth, occurrenceDate: scheduledDate });
    }
    return { sequence: index + 1, scheduledDate, principalAmount, feeAmount: feeAmounts ? feeAmounts[index] : 0 };
  });
}
