"use client";

import { useRef, useState, type KeyboardEvent } from "react";

import { CalendarDayCell } from "@/components/calendar/CalendarDayCell";
import type { CalendarCell } from "@/domain/calendar/types";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

const STEP_BY_KEY: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowLeft: -1,
  ArrowDown: 7,
  ArrowUp: -7,
};

function preferredFocusDate(cells: readonly CalendarCell[], selectedDate: string | null): string | null {
  if (selectedDate && cells.some((cell) => cell.date === selectedDate)) return selectedDate;
  return cells.find((cell) => cell.isToday)?.date ?? cells[0]?.date ?? null;
}

export function CalendarGrid({
  cells,
  selectedDate,
  onSelect,
}: Readonly<{
  cells: readonly CalendarCell[];
  selectedDate: string | null;
  onSelect: (date: string) => void;
}>) {
  const gridRef = useRef<HTMLDivElement>(null);
  const preferredDate = preferredFocusDate(cells, selectedDate);
  const [roving, setRoving] = useState(() => ({ selectedDate, date: preferredDate }));
  const candidateDate = roving.selectedDate === selectedDate ? roving.date : preferredDate;
  const tabStopDate = candidateDate && cells.some((cell) => cell.date === candidateDate) ? candidateDate : preferredDate;

  function selectDate(date: string) {
    setRoving({ selectedDate, date });
    onSelect(date);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const date = target.dataset.date;
    if (!date) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectDate(date);
      return;
    }

    const step = STEP_BY_KEY[event.key];
    if (step === undefined) return;

    const current = cells.findIndex((cell) => cell.date === date);
    if (current < 0) return;

    event.preventDefault();
    const next = current + step;
    if (next < 0 || next >= cells.length) return;

    const nextDate = cells[next].date;
    setRoving({ selectedDate, date: nextDate });
    gridRef.current?.querySelector<HTMLElement>(`[data-date="${nextDate}"]`)?.focus();
  }

  return (
    <div ref={gridRef} role="grid" aria-label="월별 기록" onKeyDown={onKeyDown} className="flex flex-col gap-1">
      <div role="row" className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} role="columnheader" className="py-1 text-center text-xs font-semibold text-content-muted">
            {label}
          </div>
        ))}
      </div>

      {Array.from({ length: Math.ceil(cells.length / 7) }, (_, week) => (
        <div key={week} role="row" className="grid grid-cols-7 gap-1">
          {cells.slice(week * 7, week * 7 + 7).map((cell) => (
            <CalendarDayCell
              key={cell.date}
              cell={cell}
              selected={cell.date === selectedDate}
              tabIndex={cell.date === tabStopDate ? 0 : -1}
              onSelect={selectDate}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
