import { describe, expect, it } from "vitest";

import { addIsoDays, seoulDayStartUtcIso, todayInSeoul, toSeoulDate } from "@/lib/dates/seoul";

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

  it("rejects an unparseable timestamp", () => {
    expect(() => toSeoulDate("not-a-timestamp")).toThrow(RangeError);
  });
});

describe("seoulDayStartUtcIso", () => {
  it("maps Seoul midnight to 15:00 UTC on the previous day", () => {
    expect(seoulDayStartUtcIso("2026-08-05")).toBe("2026-08-04T15:00:00.000Z");
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
});

describe("todayInSeoul", () => {
  it("derives the Seoul date from the supplied instant", () => {
    expect(todayInSeoul(new Date("2026-08-05T15:30:00Z"))).toBe("2026-08-06");
  });
});
