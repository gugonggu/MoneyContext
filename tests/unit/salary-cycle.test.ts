import { describe, expect, it } from "vitest";
import { getSalaryCycle } from "@/lib/dates/salary-cycle";

describe("salary cycle", () => {
  it("uses the salary day as the cycle start", () => {
    expect(getSalaryCycle("2026-08-10", 10)).toEqual({ start: "2026-08-10", end: "2026-09-09" });
  });

  it("clamps a month-end salary day to the last calendar day", () => {
    expect(getSalaryCycle("2026-04-30", 31)).toEqual({ start: "2026-04-30", end: "2026-05-30" });
  });
});
