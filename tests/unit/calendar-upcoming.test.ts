import { describe, expect, it } from "vitest";

import { collectUpcomingMarkers } from "@/domain/calendar/upcoming";

const EMPTY = { planned: [], cards: [], recurringRules: [], confirmedRecurringDates: [] };

describe("collectUpcomingMarkers", () => {
  it("marks a planned transaction on its scheduled date", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "2026-08-01",
      rangeEnd: "2026-08-31",
      planned: [{ scheduledDate: "2026-08-12", type: "EXPENSE", amount: 30_000, baseAmount: 30_000, memo: "치과" }],
    });

    expect(markers.get("2026-08-12")).toEqual([
      { kind: "PLANNED", label: "치과", amount: 30_000, direction: "EXPENSE" },
    ]);
  });

  it("labels a planned transaction without a memo", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "2026-08-01",
      rangeEnd: "2026-08-31",
      planned: [{ scheduledDate: "2026-08-12", type: "INCOME", amount: 50_000, baseAmount: 50_000 }],
    });

    expect(markers.get("2026-08-12")?.[0].label).toBe("예정 수입");
  });

  it("ignores a planned transaction outside the range", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "2026-08-01",
      rangeEnd: "2026-08-31",
      planned: [{ scheduledDate: "2026-09-12", type: "EXPENSE", amount: 30_000, baseAmount: 30_000 }],
    });

    expect(markers.size).toBe(0);
  });

  it("marks a card payment day in every month the range covers", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "2026-07-26",
      rangeEnd: "2026-09-05",
      cards: [{ accountId: "card-1", accountName: "국민카드", paymentDay: 25 }],
    });

    expect(markers.get("2026-07-25")).toBeUndefined();
    expect(markers.get("2026-08-25")?.[0]).toEqual({
      kind: "CARD_PAYMENT",
      label: "국민카드 결제",
      direction: "EXPENSE",
    });
  });

  it("skips payment dates before a card's first payment date (e.g. a card issued mid-cycle)", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "2026-08-01",
      rangeEnd: "2026-10-31",
      cards: [{ accountId: "card-1", accountName: "새 카드", paymentDay: 14, firstPaymentDate: "2026-09-14" }],
    });

    expect(markers.get("2026-08-14")).toBeUndefined();
    expect(markers.get("2026-09-14")?.[0].kind).toBe("CARD_PAYMENT");
    expect(markers.get("2026-10-14")?.[0].kind).toBe("CARD_PAYMENT");
  });

  it("clamps a 31st payment day to the last day of February", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "2026-02-01",
      rangeEnd: "2026-02-28",
      cards: [{ accountId: "card-1", accountName: "국민카드", paymentDay: 31 }],
    });

    expect(markers.get("2026-02-28")?.[0].kind).toBe("CARD_PAYMENT");
  });

  it("clamps a 31st payment day to a 29-day February", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "2028-02-01",
      rangeEnd: "2028-02-29",
      cards: [{ accountId: "card-1", accountName: "국민카드", paymentDay: 31 }],
    });

    expect(markers.get("2028-02-29")?.[0].kind).toBe("CARD_PAYMENT");
  });

  it("preserves early ISO years when calculating card payment dates", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "0099-02-01",
      rangeEnd: "0099-02-28",
      cards: [{ accountId: "card-1", accountName: "국민카드", paymentDay: 31 }],
    });

    expect(markers.get("0099-02-28")?.[0].kind).toBe("CARD_PAYMENT");
  });

  it("expands a monthly recurring rule across the range", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "2026-08-01",
      rangeEnd: "2026-10-31",
      recurringRules: [
        {
          id: "rule-1",
          memo: "월세",
          type: "EXPENSE",
          amount: 600_000,
          frequency: "MONTHLY",
          intervalCount: 1,
          dayOfMonth: 5,
          nextRunDate: "2026-08-05",
        },
      ],
    });

    expect(markers.get("2026-08-05")?.[0].label).toBe("월세");
    expect(markers.get("2026-09-05")?.[0].label).toBe("월세");
    expect(markers.get("2026-10-05")?.[0].label).toBe("월세");
  });

  it("stops expanding a recurring rule at its end date", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "2026-08-01",
      rangeEnd: "2026-10-31",
      recurringRules: [
        {
          id: "rule-1",
          memo: "월세",
          type: "EXPENSE",
          amount: 600_000,
          frequency: "MONTHLY",
          intervalCount: 1,
          dayOfMonth: 5,
          nextRunDate: "2026-08-05",
          endDate: "2026-09-30",
        },
      ],
    });

    expect(markers.get("2026-09-05")).toBeDefined();
    expect(markers.get("2026-10-05")).toBeUndefined();
  });

  it("does not double-mark a recurrence the cron already turned into a transaction", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "2026-08-01",
      rangeEnd: "2026-08-31",
      recurringRules: [
        {
          id: "rule-1",
          memo: "월세",
          type: "EXPENSE",
          amount: 600_000,
          frequency: "MONTHLY",
          intervalCount: 1,
          dayOfMonth: 5,
          nextRunDate: "2026-08-05",
        },
      ],
      confirmedRecurringDates: [{ ruleId: "rule-1", date: "2026-08-05" }],
    });

    expect(markers.get("2026-08-05")).toBeUndefined();
  });

  it("still marks another rule on a date where a different rule was already generated", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "2026-08-01",
      rangeEnd: "2026-08-31",
      recurringRules: [
        { id: "rule-1", memo: "월세", type: "EXPENSE", amount: 600_000, frequency: "MONTHLY", intervalCount: 1, dayOfMonth: 5, nextRunDate: "2026-08-05" },
        { id: "rule-2", memo: "통신비", type: "EXPENSE", amount: 55_000, frequency: "MONTHLY", intervalCount: 1, dayOfMonth: 5, nextRunDate: "2026-08-05" },
      ],
      confirmedRecurringDates: [{ ruleId: "rule-1", date: "2026-08-05" }],
    });

    expect(markers.get("2026-08-05")?.map((marker) => marker.label)).toEqual(["통신비"]);
  });

  it("expands a weekly rule", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "2026-08-01",
      rangeEnd: "2026-08-31",
      recurringRules: [
        { id: "rule-1", memo: "주간 지출", type: "EXPENSE", amount: 50_000, frequency: "WEEKLY", intervalCount: 1, nextRunDate: "2026-08-03" },
      ],
    });

    for (const date of ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31"]) {
      expect(markers.get(date)?.[0].label).toBe("주간 지출");
    }
  });

  it("keeps a recurrence that lands on the upper ISO date boundary", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "9999-12-31",
      rangeEnd: "9999-12-31",
      recurringRules: [
        { id: "rule-1", memo: "boundary", type: "EXPENSE", amount: 50_000, frequency: "DAILY", intervalCount: 1, nextRunDate: "9999-12-31" },
      ],
    });

    expect(markers.get("9999-12-31")?.[0]).toMatchObject({ kind: "RECURRING", label: "boundary" });
  });

  it("reaches a future range for a daily rule that started more than 4,000 days earlier", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "2037-01-01",
      rangeEnd: "2037-01-02",
      recurringRules: [
        { id: "rule-1", memo: "daily", type: "EXPENSE", amount: 50_000, frequency: "DAILY", intervalCount: 1, nextRunDate: "2026-01-01" },
      ],
    });

    expect(markers.get("2037-01-01")?.[0]).toMatchObject({ kind: "RECURRING", label: "daily" });
    expect(markers.get("2037-01-02")?.[0]).toMatchObject({ kind: "RECURRING", label: "daily" });
  });

  it("sorts several markers on one day by kind", () => {
    const markers = collectUpcomingMarkers({
      ...EMPTY,
      rangeStart: "2026-08-01",
      rangeEnd: "2026-08-31",
      planned: [{ scheduledDate: "2026-08-25", type: "EXPENSE", amount: 10_000, baseAmount: 10_000, memo: "예정" }],
      cards: [{ accountId: "card-1", accountName: "국민카드", paymentDay: 25 }],
    });

    expect(markers.get("2026-08-25")?.map((marker) => marker.kind)).toEqual(["CARD_PAYMENT", "PLANNED"]);
  });
});
