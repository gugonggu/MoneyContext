"use client";

import { cx } from "@/components/ui/cx";
import type { CalendarCell, HeatLevel } from "@/domain/calendar/types";

const WEEKDAY_NAMES = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"] as const;

const HEAT_CLASSES: Record<HeatLevel, string> = {
  0: "",
  1: "bg-brand-500/6",
  2: "bg-brand-500/12",
  3: "bg-brand-500/20",
  4: "bg-brand-500/30",
};

const won = (value: number) => `${value.toLocaleString("ko-KR")}원`;

export function formatDayAriaLabel(cell: CalendarCell): string {
  const [, month, day] = cell.date.split("-").map(Number);
  const parts = [`${month}월 ${day}일`, WEEKDAY_NAMES[cell.weekday]];

  if (cell.income > 0) parts.push(`수입 ${won(cell.income)}`);
  if (cell.expense > 0) parts.push(`지출 ${won(cell.expense)}`);
  if (cell.income === 0 && cell.expense === 0) parts.push("기록 없음");
  if (cell.upcoming.length > 0) parts.push(`예정 ${cell.upcoming.length}건`);
  if (cell.isToday) parts.push("오늘");

  return parts.join(", ");
}

export function CalendarDayCell({
  cell,
  selected,
  tabIndex,
  onSelect,
}: Readonly<{
  cell: CalendarCell;
  selected: boolean;
  tabIndex: number;
  onSelect: (date: string) => void;
}>) {
  const dayNumber = Number(cell.date.slice(8, 10));
  const hasUpcoming = cell.upcoming.length > 0;

  return (
    <div
      role="gridcell"
      tabIndex={tabIndex}
      data-date={cell.date}
      aria-label={formatDayAriaLabel(cell)}
      aria-selected={selected}
      aria-current={cell.isToday ? "date" : undefined}
      onClick={() => onSelect(cell.date)}
      className={cx(
        "flex min-h-16 cursor-pointer flex-col gap-0.5 rounded-tile border p-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:min-h-20 sm:p-2",
        HEAT_CLASSES[cell.heatLevel],
        cell.inCurrentMonth ? "border-transparent" : "border-transparent opacity-40",
        selected ? "ring-2 ring-brand-500" : "",
        hasUpcoming ? "border-b-2 border-b-dashed border-b-brand-400/70" : "",
      )}
    >
      <span
        className={cx(
          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
          cell.isToday ? "bg-brand-600 text-white" : "",
          !cell.isToday && cell.weekday === 0 ? "text-negative-600 dark:text-negative-500" : "",
          !cell.isToday && cell.weekday === 6 ? "text-brand-600 dark:text-brand-400" : "",
          !cell.isToday && cell.weekday > 0 && cell.weekday < 6 ? "text-content-secondary" : "",
        )}
      >
        {dayNumber}
      </span>

      <span
        aria-hidden="true"
        className="mt-auto flex flex-col gap-px text-[10px] font-semibold leading-tight tabular-nums sm:text-xs"
      >
        {cell.income > 0 ? (
          <span className="truncate text-positive-600 dark:text-positive-500">+{cell.income.toLocaleString("ko-KR")}</span>
        ) : null}
        {cell.expense > 0 ? (
          <span className="truncate text-content-primary">-{cell.expense.toLocaleString("ko-KR")}</span>
        ) : null}
        {hasUpcoming ? (
          <span className="inline-flex items-center gap-1 truncate text-content-muted">
            <span
              data-testid="calendar-upcoming-dot"
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500"
            />
            <span>예정 {cell.upcoming.length}</span>
          </span>
        ) : null}
      </span>
    </div>
  );
}
