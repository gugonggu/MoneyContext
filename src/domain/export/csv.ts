import { type ExportReadModel, type ExportTransaction } from "./markdown";

export const transactionCsvColumns = [
  "transaction_date",
  "transaction_type",
  "status",
  "memo",
  "category",
  "tags",
  "account",
  "from_account",
  "to_account",
  "original_amount",
  "original_currency",
  "base_amount",
  "base_currency",
] as const;

function assertNonNegativeAmount(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} must be a non-negative safe integer`);
}

function assertTransactionAmount(transaction: ExportTransaction, value: number, label: string): void {
  if (transaction.type === "ADJUSTMENT") {
    if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be a safe integer`);
    return;
  }
  assertNonNegativeAmount(value, label);
}

function seoulDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError("transactionDate must be a valid date-time");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: "year" | "month" | "day") => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function inPeriod(transaction: ExportTransaction, readModel: ExportReadModel): boolean {
  const date = seoulDate(transaction.transactionDate);
  return date >= readModel.period.startDate && date <= readModel.period.endDate;
}

function escapeCsvCell(value: string | number | undefined): string {
  if (value === undefined) return "";
  const text = typeof value === "string" && /^[\s\x00-\x1F]*[=+\-@]/.test(value) ? `'${value}` : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function transactionRow(transaction: ExportTransaction, baseCurrency: string): readonly (string | number | undefined)[] {
  assertTransactionAmount(transaction, transaction.baseAmount, "transaction baseAmount");
  if (transaction.originalAmount !== undefined) assertTransactionAmount(transaction, transaction.originalAmount, "transaction originalAmount");
  return [
    seoulDate(transaction.transactionDate),
    transaction.type,
    transaction.status,
    transaction.memo,
    transaction.categoryName,
    transaction.tagNames?.join(","),
    transaction.accountName,
    transaction.fromAccountName,
    transaction.toAccountName,
    transaction.originalAmount,
    transaction.originalCurrency,
    transaction.baseAmount,
    baseCurrency,
  ];
}

export function generateTransactionCsv(readModel: ExportReadModel): string {
  const rows = readModel.transactions
    .filter((transaction) => inPeriod(transaction, readModel))
    .map((transaction) => transactionRow(transaction, readModel.baseCurrency).map(escapeCsvCell).join(","));
  return `\uFEFF${transactionCsvColumns.join(",")}\r\n${rows.join("\r\n")}\r\n`;
}
