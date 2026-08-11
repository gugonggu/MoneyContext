import { describe, expect, it } from "vitest";
import { isDueOnOrBefore, nextOccurrenceDate } from "@/domain/recurring/schedule";

describe("recurring schedule", () => {
  it("clamps a monthly occurrence to the final day of a shorter month", () => {
    expect(
      nextOccurrenceDate({
        frequency: "MONTHLY",
        intervalCount: 1,
        dayOfMonth: 31,
        occurrenceDate: "2026-01-31",
      }),
    ).toBe("2026-02-28");
  });

  it("returns to the configured monthly day after a shorter month clamp", () => {
    expect(
      nextOccurrenceDate({
        frequency: "MONTHLY",
        intervalCount: 1,
        dayOfMonth: 31,
        occurrenceDate: "2026-02-28",
      }),
    ).toBe("2026-03-31");
  });

  it("advances a daily occurrence by its interval", () => {
    expect(nextOccurrenceDate({ frequency: "DAILY", intervalCount: 3, occurrenceDate: "2026-08-11" })).toBe(
      "2026-08-14",
    );
  });

  it("advances a weekly occurrence by its interval", () => {
    expect(nextOccurrenceDate({ frequency: "WEEKLY", intervalCount: 2, occurrenceDate: "2026-08-11" })).toBe(
      "2026-08-25",
    );
  });

  it("treats an occurrence on the run date as due", () => {
    expect(isDueOnOrBefore("2026-08-15", "2026-08-15")).toBe(true);
  });

  it("rejects a daily occurrence that would exceed the four-digit year range", () => {
    expect(() => nextOccurrenceDate({ frequency: "DAILY", intervalCount: 1, occurrenceDate: "9999-12-31" })).toThrow(
      RangeError,
    );
  });
});
