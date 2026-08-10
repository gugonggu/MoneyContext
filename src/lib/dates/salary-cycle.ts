export function getSalaryCycle(referenceDate: string, salaryDay: number): { start: string; end: string } {
  if (!Number.isInteger(salaryDay) || salaryDay < 1 || salaryDay > 31) throw new RangeError("salary day must be between 1 and 31");
  const [year, month, day] = referenceDate.split("-").map(Number);
  if (!year || !month || !day) throw new RangeError("reference date must be YYYY-MM-DD");
  const boundary = (targetYear: number, targetMonth: number) => new Date(Date.UTC(targetYear, targetMonth, Math.min(salaryDay, new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate())));
  const currentBoundary = boundary(year, month - 1);
  const start = day >= currentBoundary.getUTCDate() ? currentBoundary : boundary(year, month - 2);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, Math.min(salaryDay, new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 2, 0)).getUTCDate()) - 1));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
