import { cleanup, fireEvent, render, screen, waitForElementToBeRemoved } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/calendar",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { CalendarMonthView } from "@/components/calendar/CalendarMonthView";
import { buildMonthGrid } from "@/domain/calendar/month";
import type { CalendarCell, CalendarMonth } from "@/domain/calendar/types";

afterEach(cleanup);

function cell(overrides: Partial<CalendarCell> & Pick<CalendarCell, "date">): CalendarCell {
  return {
    inCurrentMonth: true,
    isToday: false,
    weekday: 0,
    income: 0,
    expense: 0,
    heatLevel: 0,
    transactions: [],
    upcoming: [],
    ...overrides,
  };
}

function month(overrides: readonly CalendarCell[] = [], summary = { income: 0, expense: 0, net: 0 }): CalendarMonth {
  const cells = buildMonthGrid(2026, 8, "2026-08-13").map((day) => cell(day));
  for (const override of overrides) {
    const at = cells.findIndex((item) => item.date === override.date);
    if (at >= 0) cells[at] = override;
  }
  return { year: 2026, month: 8, cells, summary };
}

describe("CalendarMonthView", () => {
  it("titles the month and shows the summary", () => {
    render(<CalendarMonthView month={month([], { income: 2_500_000, expense: 47_000, net: 2_453_000 })} />);

    expect(screen.getByRole("heading", { name: "2026년 8월" })).toBeTruthy();
    expect(screen.getByText("2,500,000원")).toBeTruthy();
    expect(screen.getByText("47,000원")).toBeTruthy();
  });

  it("links to the neighbouring months through the ym query", () => {
    render(<CalendarMonthView month={month()} />);

    expect(screen.getByRole("link", { name: "이전 달" }).getAttribute("href")).toBe("/calendar?ym=2026-07");
    expect(screen.getByRole("link", { name: "다음 달" }).getAttribute("href")).toBe("/calendar?ym=2026-09");
  });

  it("crosses the year boundary in the month links", () => {
    const december: CalendarMonth = { ...month(), year: 2026, month: 12 };
    render(<CalendarMonthView month={december} />);

    expect(screen.getByRole("link", { name: "이전 달" }).getAttribute("href")).toBe("/calendar?ym=2026-11");
    expect(screen.getByRole("link", { name: "다음 달" }).getAttribute("href")).toBe("/calendar?ym=2027-01");
  });

  it("opens the day sheet with that day's transactions", () => {
    const view = month([
      cell({
        date: "2026-08-05",
        expense: 47_000,
        transactions: [
          { id: "t1", type: "EXPENSE", baseAmount: 47_000, memo: "점심", categoryName: "식비", accountName: "국민카드" },
        ],
      }),
    ]);
    render(<CalendarMonthView month={view} />);

    fireEvent.click(screen.getByLabelText(/8월 5일/));

    expect(screen.getByRole("dialog", { name: "2026년 8월 5일" })).toBeTruthy();
    expect(screen.getByText("점심")).toBeTruthy();
    expect(screen.getByText("식비 · 국민카드")).toBeTruthy();
  });

  it("separates upcoming items from confirmed ones in the sheet", () => {
    const view = month([
      cell({
        date: "2026-08-25",
        upcoming: [{ kind: "CARD_PAYMENT", label: "국민카드 결제", direction: "EXPENSE" }],
      }),
    ]);
    render(<CalendarMonthView month={view} />);

    fireEvent.click(screen.getByLabelText(/8월 25일/));

    expect(screen.getByRole("heading", { name: "예정" })).toBeTruthy();
    expect(screen.getByText("국민카드 결제")).toBeTruthy();
    expect(screen.getByText(/수입·지출 합계에는 포함되지 않아요/)).toBeTruthy();
  });

  it("offers a record link seeded with the chosen date", () => {
    render(<CalendarMonthView month={month()} />);

    fireEvent.click(screen.getByLabelText(/8월 5일/));

    expect(screen.getByRole("link", { name: "이 날짜로 기록" }).getAttribute("href")).toBe(
      "/transactions/new?date=2026-08-05",
    );
  });

  it("prompts to start recording when the month is empty", () => {
    render(<CalendarMonthView month={month()} />);

    expect(screen.getByText(/이번 달 기록이 아직 없어요/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "첫 거래 기록" }).getAttribute("href")).toBe("/transactions/new");
  });

  it("hides the empty state once the month has a transaction", () => {
    const view = month([cell({ date: "2026-08-05", expense: 47_000 })], { income: 0, expense: 47_000, net: -47_000 });
    render(<CalendarMonthView month={view} />);

    expect(screen.queryByText(/이번 달 기록이 아직 없어요/)).toBeNull();
  });

  it("offers a month and week toggle", () => {
    render(<CalendarMonthView month={month()} />);

    expect(screen.getByRole("radiogroup", { name: "보기 방식" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "월" }).getAttribute("aria-checked")).toBe("true");
  });

  it("narrows the grid to one week in week view", () => {
    render(<CalendarMonthView month={month()} />);

    fireEvent.click(screen.getByRole("radio", { name: "주" }));

    expect(screen.getAllByRole("gridcell")).toHaveLength(7);
  });

  it("shows the week containing the selected day", () => {
    render(<CalendarMonthView month={month()} />);

    fireEvent.click(screen.getByLabelText(/8월 9일/));
    fireEvent.click(screen.getByRole("radio", { name: "주" }));

    expect(screen.getByRole("gridcell", { name: /8월 9일/ })).toBeTruthy();
    expect(screen.getByRole("gridcell", { name: /8월 15일/ })).toBeTruthy();
    expect(screen.queryByRole("gridcell", { name: /8월 8일/ })).toBeNull();
  });

  it("uses the new month's today cell after navigation instead of a stale selection", () => {
    const { rerender } = render(<CalendarMonthView month={month()} />);
    fireEvent.click(screen.getByLabelText(/8월 5일/));

    const septemberCells = buildMonthGrid(2026, 9, "2026-09-17").map((day) => cell(day));
    rerender(
      <CalendarMonthView
        month={{ year: 2026, month: 9, cells: septemberCells, summary: { income: 0, expense: 0, net: 0 } }}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "주" }));

    expect(screen.getByRole("gridcell", { name: /9월 17일/ })).toBeTruthy();
    expect(screen.queryByRole("gridcell", { name: /8월 5일/ })).toBeNull();
  });

  it("closes the day sheet when the selected date becomes a neighbour cell after navigation", async () => {
    const { rerender } = render(<CalendarMonthView month={month()} />);
    fireEvent.click(screen.getByLabelText(/8월 31일/));
    expect(screen.getByRole("dialog", { name: "2026년 8월 31일" })).toBeTruthy();

    const septemberCells = buildMonthGrid(2026, 9, "2026-09-17").map((day) => cell(day));
    rerender(
      <CalendarMonthView
        month={{ year: 2026, month: 9, cells: septemberCells, summary: { income: 0, expense: 0, net: 0 } }}
      />,
    );

    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
  });

  it("does not anchor week view to a stale selection that is a neighbour cell in the new month", () => {
    const { rerender } = render(<CalendarMonthView month={month()} />);
    fireEvent.click(screen.getByLabelText(/8월 31일/));

    const septemberCells = buildMonthGrid(2026, 9, "2026-09-17").map((day) => cell(day));
    rerender(
      <CalendarMonthView
        month={{ year: 2026, month: 9, cells: septemberCells, summary: { income: 0, expense: 0, net: 0 } }}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "주" }));

    expect(screen.getByRole("gridcell", { name: /9월 17일/ })).toBeTruthy();
    expect(screen.queryByRole("gridcell", { name: /8월 31일/ })).toBeNull();
  });
});
