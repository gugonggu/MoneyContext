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

  it("advances a weekly occurrence by its interval", () => {
    expect(nextOccurrenceDate({ frequency: "WEEKLY", intervalCount: 2, occurrenceDate: "2026-08-11" })).toBe(
      "2026-08-25",
    );
  });

  it("treats an occurrence on the run date as due", () => {
    expect(isDueOnOrBefore("2026-08-15", "2026-08-15")).toBe(true);
  });
});
