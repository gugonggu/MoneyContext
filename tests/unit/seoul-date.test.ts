import { describe, expect, it } from "vitest";

import { addIsoDays, seoulDayStartUtcIso, seoulWallClockToUtcIso, todayInSeoul, toSeoulDate, utcIsoToSeoulWallClock } from "@/lib/dates/seoul";

describe("toSeoulDate", () => {
  it("keeps a mid-day UTC timestamp on the same Seoul day", () => {
    expect(toSeoulDate("2026-08-05T03:00:00Z")).toBe("2026-08-05");
  });

  it("rolls a late-evening UTC timestamp into the next Seoul day", () => {
    expect(toSeoulDate("2026-08-05T15:30:00Z")).toBe("2026-08-06");
  });

  it("keeps an early-morning UTC timestamp on the same Seoul day", () => {
    expect(toSeoulDate("2026-08-05T00:30:00Z")).toBe("2026-08-05");
  });

  it("handles a month boundary", () => {
    expect(toSeoulDate("2026-07-31T15:00:00Z")).toBe("2026-08-01");
  });

  it("handles a year boundary", () => {
    expect(toSeoulDate("2026-12-31T15:00:00Z")).toBe("2027-01-01");
  });

  it("pads an early year to the declared ISO date width", () => {
    expect(toSeoulDate("0099-08-05T03:00:00Z")).toBe("0099-08-05");
  });

  it("preserves ISO year zero instead of Intl's year-of-era value", () => {
    expect(toSeoulDate("0000-08-05T03:00:00Z")).toBe("0000-08-05");
  });

  it("rejects an unparseable timestamp", () => {
    expect(() => toSeoulDate("not-a-timestamp")).toThrow(RangeError);
  });
});

describe("seoulDayStartUtcIso", () => {
  it("maps Seoul midnight to 15:00 UTC on the previous day", () => {
    expect(seoulDayStartUtcIso("2026-08-05")).toBe("2026-08-04T15:00:00.000Z");
  });

  it("preserves an early year instead of applying Date.UTC's 1900 offset", () => {
    expect(seoulDayStartUtcIso("0099-08-05")).toBe("0099-08-04T15:00:00.000Z");
  });

  it("rejects a malformed date", () => {
    expect(() => seoulDayStartUtcIso("2026-8-5")).toThrow(RangeError);
  });

  it("rejects an impossible calendar date", () => {
    expect(() => seoulDayStartUtcIso("2026-02-29")).toThrow(RangeError);
  });
});

describe("addIsoDays", () => {
  it("adds days across a month boundary", () => {
    expect(addIsoDays("2026-08-30", 3)).toBe("2026-09-02");
  });

  it("subtracts days across a year boundary", () => {
    expect(addIsoDays("2026-01-02", -3)).toBe("2025-12-30");
  });

  it("handles a leap day", () => {
    expect(addIsoDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("carries an early year into the next ISO year", () => {
    expect(addIsoDays("0099-12-31", 1)).toBe("0100-01-01");
  });

  it("rejects a result before the supported ISO year range", () => {
    expect(() => addIsoDays("0000-01-01", -1)).toThrow(RangeError);
  });

  it("rejects a result after the supported ISO year range", () => {
    expect(() => addIsoDays("9999-12-31", 1)).toThrow(RangeError);
  });
});

describe("todayInSeoul", () => {
  it("derives the Seoul date from the supplied instant", () => {
    expect(todayInSeoul(new Date("2026-08-05T15:30:00Z"))).toBe("2026-08-06");
  });
});

// A datetime-local input's value is always Korea wall-clock time in this app,
// never the server process's own timezone - new Date(value).toISOString()
// would silently assume the runtime's local zone (fine on a Seoul-set dev
// machine, wrong on Vercel's UTC runtime), so this must convert explicitly.
describe("seoulWallClockToUtcIso", () => {
  it("converts an evening Seoul time to the correct earlier UTC instant", () => {
    expect(seoulWallClockToUtcIso("2026-08-05T23:30")).toBe("2026-08-05T14:30:00.000Z");
  });

  it("rolls a near-midnight Seoul time into the previous UTC day", () => {
    expect(seoulWallClockToUtcIso("2026-08-05T00:30")).toBe("2026-08-04T15:30:00.000Z");
  });

  it("accepts an optional seconds component", () => {
    expect(seoulWallClockToUtcIso("2026-08-05T09:00:15")).toBe("2026-08-05T00:00:15.000Z");
  });

  it("rejects a value that isn't an ISO-like datetime string", () => {
    expect(() => seoulWallClockToUtcIso("2026-08-05")).toThrow(RangeError);
    expect(() => seoulWallClockToUtcIso("not-a-datetime")).toThrow(RangeError);
  });
});

describe("utcIsoToSeoulWallClock", () => {
  it("renders a UTC instant as the equivalent Seoul wall-clock string", () => {
    expect(utcIsoToSeoulWallClock("2026-08-05T14:30:00.000Z")).toBe("2026-08-05T23:30");
  });

  it("rolls a late-evening UTC instant into the next Seoul day", () => {
    expect(utcIsoToSeoulWallClock("2026-08-05T15:30:00.000Z")).toBe("2026-08-06T00:30");
  });

  it("round-trips through seoulWallClockToUtcIso", () => {
    expect(utcIsoToSeoulWallClock(seoulWallClockToUtcIso("2026-08-05T23:30"))).toBe("2026-08-05T23:30");
  });

  it("rejects an unparseable timestamp", () => {
    expect(() => utcIsoToSeoulWallClock("not-a-timestamp")).toThrow(RangeError);
  });
});
