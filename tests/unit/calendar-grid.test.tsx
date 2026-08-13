import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CalendarDayCell, formatDayAriaLabel } from "@/components/calendar/CalendarDayCell";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { buildMonthGrid } from "@/domain/calendar/month";
import type { CalendarCell } from "@/domain/calendar/types";

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

function grid(overrides: readonly CalendarCell[]): CalendarCell[] {
  const cells = buildMonthGrid(2026, 8, "2026-08-12").map((day) => cell(day));
  for (const override of overrides) {
    const at = cells.findIndex((item) => item.date === override.date);
    if (at >= 0) cells[at] = override;
  }
  return cells;
}

describe("formatDayAriaLabel", () => {
  it("states the date, weekday, expense, and upcoming count as text", () => {
    const label = formatDayAriaLabel(
      cell({
        date: "2026-08-05",
        weekday: 3,
        expense: 47_000,
        upcoming: [{ kind: "PLANNED", label: "치과", amount: 30_000, direction: "EXPENSE" }],
      }),
    );

    expect(label).toContain("8월 5일");
    expect(label).toContain("수요일");
    expect(label).toContain("지출 47,000원");
    expect(label).toContain("예정 1건");
  });

  it("mentions income when there is income", () => {
    expect(formatDayAriaLabel(cell({ date: "2026-08-25", income: 2_500_000 }))).toContain("수입 2,500,000원");
  });

  it("says there is no confirmed record on an empty day", () => {
    expect(formatDayAriaLabel(cell({ date: "2026-08-07" }))).toContain("기록 없음");
  });

  it("announces today without relying on the filled date style", () => {
    expect(formatDayAriaLabel(cell({ date: "2026-08-12", weekday: 3, isToday: true }))).toContain("오늘");
  });
});

describe("CalendarDayCell", () => {
  it("uses a dashed token border only when upcoming items are present", () => {
    const { rerender } = render(
      <CalendarDayCell
        cell={cell({ date: "2026-08-12", expense: 10_000 })}
        selected={false}
        tabIndex={0}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByRole("gridcell").className).not.toContain("border-b-dashed");

    rerender(
      <CalendarDayCell
        cell={cell({
          date: "2026-08-12",
          expense: 10_000,
          upcoming: [{ kind: "PLANNED", label: "치과", direction: "EXPENSE" }],
        })}
        selected={false}
        tabIndex={0}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByRole("gridcell").className).toContain("border-b-dashed");
    expect(screen.getByRole("gridcell").className).toContain("border-b-brand-400/70");
  });
});

describe("CalendarGrid", () => {
  it("renders a gridcell for all 42 days", () => {
    render(<CalendarGrid cells={grid([])} selectedDate={null} onSelect={() => {}} />);

    expect(screen.getAllByRole("gridcell")).toHaveLength(42);
  });

  it("shows amount lines only when a day has confirmed income or expense", () => {
    render(
      <CalendarGrid
        cells={grid([cell({ date: "2026-08-25", income: 2_500_000 }), cell({ date: "2026-08-05", expense: 47_000 })])}
        selectedDate={null}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText("+2,500,000")).toBeTruthy();
    expect(screen.getByText("-47,000")).toBeTruthy();
  });

  it("marks a day that has upcoming items", () => {
    render(
      <CalendarGrid
        cells={grid([
          cell({ date: "2026-08-12", upcoming: [{ kind: "CARD_PAYMENT", label: "국민카드 결제", direction: "EXPENSE" }] }),
        ])}
        selectedDate={null}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByLabelText(/8월 12일.*기록 없음.*예정 1건/)).toBeTruthy();
  });

  it("reports the clicked date", () => {
    const onSelect = vi.fn();
    render(<CalendarGrid cells={grid([])} selectedDate={null} onSelect={onSelect} />);

    fireEvent.click(screen.getByLabelText(/8월 5일/));

    expect(onSelect).toHaveBeenCalledWith("2026-08-05");
  });

  it.each([
    ["ArrowRight", "8월 6일"],
    ["ArrowLeft", "8월 4일"],
    ["ArrowDown", "8월 12일"],
    ["ArrowUp", "7월 29일"],
  ])("moves focus from August 5 with %s", (key, expectedLabel) => {
    render(<CalendarGrid cells={grid([])} selectedDate="2026-08-05" onSelect={() => {}} />);
    const start = screen.getByLabelText(/8월 5일/);
    start.focus();

    fireEvent.keyDown(start, { key });

    expect(document.activeElement).toBe(screen.getByLabelText(new RegExp(expectedLabel)));
  });

  it.each([
    ["2026-07-26", "ArrowLeft"],
    ["2026-07-26", "ArrowUp"],
    ["2026-09-05", "ArrowRight"],
    ["2026-09-05", "ArrowDown"],
  ])("keeps focus inside the grid at %s on %s", (selectedDate, key) => {
    render(<CalendarGrid cells={grid([])} selectedDate={selectedDate} onSelect={() => {}} />);
    const start = screen.getByRole("gridcell", { selected: true });
    start.focus();

    fireEvent.keyDown(start, { key });

    expect(document.activeElement).toBe(start);
  });

  it.each(["Enter", " "])("selects the focused day on %j", (key) => {
    const onSelect = vi.fn();
    render(<CalendarGrid cells={grid([])} selectedDate={null} onSelect={onSelect} />);
    const target = screen.getByLabelText(/8월 9일/);

    fireEvent.keyDown(target, { key });

    expect(onSelect).toHaveBeenCalledWith("2026-08-09");
  });

  it("keeps exactly one roving tab stop and moves it with focus", () => {
    render(<CalendarGrid cells={grid([])} selectedDate="2026-08-05" onSelect={() => {}} />);
    const start = screen.getByLabelText(/8월 5일/);
    start.focus();

    fireEvent.keyDown(start, { key: "ArrowRight" });

    const tabbable = screen.getAllByRole("gridcell").filter((node) => node.getAttribute("tabindex") === "0");
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0].getAttribute("aria-label")).toContain("8월 6일");
  });

  it("uses today as the single tab stop when no date is selected", () => {
    render(<CalendarGrid cells={grid([])} selectedDate={null} onSelect={() => {}} />);
    const tabbable = screen.getAllByRole("gridcell").filter((node) => node.getAttribute("tabindex") === "0");

    expect(tabbable).toHaveLength(1);
    expect(tabbable[0].getAttribute("aria-label")).toContain("8월 12일");
  });

  it("labels the weekday header row", () => {
    render(<CalendarGrid cells={grid([])} selectedDate={null} onSelect={() => {}} />);

    for (const day of ["일", "월", "화", "수", "목", "금", "토"]) {
      expect(screen.getByRole("columnheader", { name: day })).toBeTruthy();
    }
  });
});
