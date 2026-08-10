export function splitInstallmentPrincipal(totalAmount: number, installmentCount: number): number[] {
  if (!Number.isSafeInteger(totalAmount) || totalAmount < 0 || !Number.isInteger(installmentCount) || installmentCount < 2) throw new RangeError("invalid installment input");
  const base = Math.floor(totalAmount / installmentCount);
  const remainder = totalAmount % installmentCount;
  return Array.from({ length: installmentCount }, (_, index) => base + (index < remainder ? 1 : 0));
}
