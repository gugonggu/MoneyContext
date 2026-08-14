import { describe, expect, it } from "vitest";

import { resolveExportPeriod, resolvePeriodAggregation, type ExportPeriodInput } from "@/domain/export/period";

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

describe("resolvePeriodAggregation", () => {
  const asOf = new Date("2026-08-14T06:09:42.000Z");

  it("clamps a mid-month selection to today's Asia/Seoul date and marks it in progress", () => {
    expect(resolvePeriodAggregation({ startDate: "2026-08-01", endDate: "2026-08-31" }, asOf)).toEqual({
      asOfDate: "2026-08-14",
      actualDataStartDate: "2026-08-01",
      actualDataEndDate: "2026-08-14",
      status: "IN_PROGRESS",
    });
  });

  it("reports a fully elapsed past period as complete, using the selected end date as-is", () => {
    expect(resolvePeriodAggregation({ startDate: "2026-07-01", endDate: "2026-07-31" }, asOf)).toEqual({
      asOfDate: "2026-08-14",
      actualDataStartDate: "2026-07-01",
      actualDataEndDate: "2026-07-31",
      status: "COMPLETE",
    });
  });

  it("reports no actual data for a period that has not started yet", () => {
    expect(resolvePeriodAggregation({ startDate: "2026-09-01", endDate: "2026-09-30" }, asOf)).toEqual({
      asOfDate: "2026-08-14",
      actualDataStartDate: null,
      actualDataEndDate: null,
      status: "NOT_STARTED",
    });
  });

  it("marks a period ending exactly today as complete", () => {
    expect(resolvePeriodAggregation({ startDate: "2026-08-01", endDate: "2026-08-14" }, asOf)).toEqual({
      asOfDate: "2026-08-14",
      actualDataStartDate: "2026-08-01",
      actualDataEndDate: "2026-08-14",
      status: "COMPLETE",
    });
  });

  it("uses the Asia/Seoul calendar date rather than the raw UTC date", () => {
    // 2026-08-14T06:09:42Z is 2026-08-14T15:09:42+09:00 in Seoul, so "today" is still the 14th, not later.
    expect(resolvePeriodAggregation({ startDate: "2026-08-01", endDate: "2026-08-14" }, asOf).asOfDate).toBe("2026-08-14");
    // A UTC instant just before Seoul midnight should not roll over to the next Seoul day.
    const beforeSeoulMidnight = new Date("2026-08-13T14:59:59.999Z");
    expect(resolvePeriodAggregation({ startDate: "2026-08-01", endDate: "2026-08-31" }, beforeSeoulMidnight).asOfDate).toBe("2026-08-13");
    const afterSeoulMidnight = new Date("2026-08-13T15:00:00.000Z");
    expect(resolvePeriodAggregation({ startDate: "2026-08-01", endDate: "2026-08-31" }, afterSeoulMidnight).asOfDate).toBe("2026-08-14");
  });
});
