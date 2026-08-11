import { describe, expect, it } from "vitest";

import { resolveExportPeriod, type ExportPeriodInput } from "@/domain/export/period";

const now = new Date("2026-08-11T09:30:00+09:00");

describe("resolveExportPeriod", () => {
  it("defaults to the current Seoul calendar month", () => {
    expect(resolveExportPeriod(undefined, now)).toEqual({
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    });
  });

  it.each([
    ["recent one month", { kind: "RECENT", months: 1 }, { startDate: "2026-08-01", endDate: "2026-08-31" }],
    ["recent three months", { kind: "RECENT", months: 3 }, { startDate: "2026-06-01", endDate: "2026-08-31" }],
    ["recent six months", { kind: "RECENT", months: 6 }, { startDate: "2026-03-01", endDate: "2026-08-31" }],
    ["a leap-year calendar month", { kind: "MONTH", month: "2024-02" }, { startDate: "2024-02-01", endDate: "2024-02-29" }],
    ["a custom inclusive range", { kind: "CUSTOM", startDate: "2026-07-10", endDate: "2026-08-02" }, { startDate: "2026-07-10", endDate: "2026-08-02" }],
  ] satisfies readonly [string, ExportPeriodInput, { startDate: string; endDate: string }][])("resolves %s", (_name, input, expected) => {
    expect(resolveExportPeriod(input, now)).toEqual(expected);
  });

  it.each<ExportPeriodInput>([
    { kind: "RECENT", months: 2 as 1 },
    { kind: "MONTH", month: "2026-13" },
    { kind: "CUSTOM", startDate: "2026-02-30", endDate: "2026-03-01" },
    { kind: "CUSTOM", startDate: "2026-08-02", endDate: "2026-08-01" },
  ])("rejects an invalid period input: %o", (input) => {
    expect(() => resolveExportPeriod(input, now)).toThrow(RangeError);
  });
});
