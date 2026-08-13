import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CalendarStrip } from "@/components/calendar/CalendarStrip";

afterEach(cleanup);

const DAYS = [
  { date: "2026-08-10", income: 0, expense: 12_000, heatLevel: 1 as const },
  { date: "2026-08-11", income: 0, expense: 0, heatLevel: 0 as const },
  { date: "2026-08-12", income: 2_500_000, expense: 47_000, heatLevel: 4 as const },
];

describe("CalendarStrip", () => {
  it("links through to the calendar page", () => {
    render(<CalendarStrip days={DAYS} />);

    expect(screen.getByRole("link", { name: /달력/ }).getAttribute("href")).toBe("/calendar");
  });

  it("renders one marker per day", () => {
    const { container } = render(<CalendarStrip days={DAYS} />);

    expect(container.querySelectorAll("[data-strip-day]")).toHaveLength(3);
  });

  it("describes each day as text rather than colour alone", () => {
    render(<CalendarStrip days={DAYS} />);

    expect(screen.getByTitle("8월 12일 지출 47,000원")).toBeTruthy();
    expect(screen.getByTitle("8월 11일 지출 없음")).toBeTruthy();
  });

  it("renders nothing when there are no days", () => {
    const { container } = render(<CalendarStrip days={[]} />);

    expect(container.querySelectorAll("[data-strip-day]")).toHaveLength(0);
  });
});
