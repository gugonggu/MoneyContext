import { resolveExportPeriod, type ExportPeriod, type ExportPeriodInput } from "@/domain/export/period";

export type DataExportInput = Readonly<{ period?: ExportPeriodInput }>;

export function parseExportPeriod(searchParams: URLSearchParams): ExportPeriodInput | undefined {
  const kind = searchParams.get("kind");
  if (kind === null) return undefined;

  if (kind === "RECENT") {
    return { kind, months: Number(searchParams.get("months")) as 1 | 3 | 6 };
  }
  if (kind === "MONTH") {
    return { kind, month: searchParams.get("month") ?? "" };
  }
  if (kind === "CUSTOM") {
    return {
      kind,
      startDate: searchParams.get("startDate") ?? "",
      endDate: searchParams.get("endDate") ?? "",
    };
  }
  throw new RangeError("unsupported export period kind");
}

export function resolveDownloadPeriod(searchParams: URLSearchParams): Readonly<{ input: DataExportInput; period: ExportPeriod }> {
  const input = { period: parseExportPeriod(searchParams) };
  return { input, period: resolveExportPeriod(input.period) };
}

export function exportFilename(kind: "analysis" | "transactions", extension: "json" | "csv", period: ExportPeriod): string {
  const dateRange = `${period.startDate}_${period.endDate}`;
  return `money-context-${kind}-${dateRange}.${extension}`;
}
