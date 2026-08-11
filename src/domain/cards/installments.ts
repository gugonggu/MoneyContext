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
