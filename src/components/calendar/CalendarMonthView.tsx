"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { CalendarDaySheet } from "@/components/calendar/CalendarDaySheet";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { springSoft } from "@/components/motion/presets";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import type { CalendarMonth } from "@/domain/calendar/types";

const won = (value: number) => `${value.toLocaleString("ko-KR")}원`;

function shiftMonth(year: number, month: number, delta: number): string {
  const index = year * 12 + (month - 1) + delta;
  return `${String(Math.floor(index / 12)).padStart(4, "0")}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function CalendarMonthView({ month }: Readonly<{ month: CalendarMonth }>) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [view, setView] = useState<"month" | "week">("month");
  const key = `${month.year}-${month.month}`;
  const monthIndex = month.year * 12 + month.month;
  const [transition, setTransition] = useState({ monthIndex, direction: 0 });
  if (transition.monthIndex !== monthIndex) {
    setTransition({ monthIndex, direction: monthIndex > transition.monthIndex ? 1 : -1 });
  }
  const direction = transition.monthIndex === monthIndex
    ? transition.direction
    : monthIndex > transition.monthIndex
      ? 1
      : -1;

  const activeSelectedDate = selectedDate && month.cells.some(
    (cell) => cell.date === selectedDate && cell.inCurrentMonth,
  )
    ? selectedDate
    : null;
  const selectedCell = activeSelectedDate
    ? (month.cells.find((cell) => cell.date === activeSelectedDate) ?? null)
    : null;
  const hasRecords = month.cells.some((cell) => cell.inCurrentMonth && (cell.income > 0 || cell.expense > 0));
  const anchorDate = activeSelectedDate
    ?? month.cells.find((cell) => cell.inCurrentMonth && cell.isToday)?.date
    ?? month.cells.find((cell) => cell.inCurrentMonth)?.date;
  const anchorIndex = anchorDate ? month.cells.findIndex((cell) => cell.date === anchorDate) : 0;
  const weekStart = Math.floor(Math.max(0, anchorIndex) / 7) * 7;
  const visibleCells = view === "week" ? month.cells.slice(weekStart, weekStart + 7) : month.cells;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Link
              href={`/calendar?ym=${shiftMonth(month.year, month.month, -1)}`}
              aria-label="이전 달"
              className="rounded-full px-2.5 py-1.5 text-content-secondary no-underline hover:bg-surface-base"
            >
              ◀
            </Link>
            <h2 className="min-w-32 text-center text-lg font-bold tracking-tight text-content-primary">
              {month.year}년 {month.month}월
            </h2>
            <Link
              href={`/calendar?ym=${shiftMonth(month.year, month.month, 1)}`}
              aria-label="다음 달"
              className="rounded-full px-2.5 py-1.5 text-content-secondary no-underline hover:bg-surface-base"
            >
              ▶
            </Link>
          </div>
          <Segmented
            label="보기 방식"
            options={[
              { value: "month", label: "월" },
              { value: "week", label: "주" },
            ]}
            value={view}
            onChange={(next) => setView(next === "week" ? "week" : "month")}
          />
        </div>

        <dl className="grid grid-cols-3 gap-2">
          <div className="rounded-tile bg-surface-base p-3">
            <dt className="text-xs text-content-secondary">수입</dt>
            <dd className="text-sm font-bold tabular-nums text-positive-600 sm:text-base dark:text-positive-500">
              {won(month.summary.income)}
            </dd>
          </div>
          <div className="rounded-tile bg-surface-base p-3">
            <dt className="text-xs text-content-secondary">지출</dt>
            <dd className="text-sm font-bold tabular-nums text-content-primary sm:text-base">
              {won(month.summary.expense)}
            </dd>
          </div>
          <div className="rounded-tile bg-surface-base p-3">
            <dt className="text-xs text-content-secondary">순액</dt>
            <dd className="text-sm font-bold tabular-nums text-content-primary sm:text-base">
              {month.summary.net >= 0 ? "+" : "-"}
              {won(Math.abs(month.summary.net))}
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <motion.div
          key={key}
          initial={{ opacity: 0, x: direction * 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={springSoft}
        >
          <CalendarGrid cells={visibleCells} selectedDate={activeSelectedDate} onSelect={setSelectedDate} />
        </motion.div>
      </Card>

      {hasRecords ? null : (
        <Card className="flex flex-col items-start gap-2 text-sm">
          <p className="font-semibold text-content-primary">이번 달 기록이 아직 없어요.</p>
          <p className="text-content-secondary">첫 지출을 기록하면 이 달력에 소비 흐름이 그려집니다.</p>
          <Link
            href="/transactions/new"
            className="mt-1 inline-flex items-center justify-center rounded-tile bg-gradient-to-br from-brand-600 to-brand-500 px-4 py-2 text-sm font-semibold text-white no-underline shadow-card"
          >
            첫 거래 기록
          </Link>
        </Card>
      )}

      <CalendarDaySheet cell={selectedCell} onClose={() => setSelectedDate(null)} />
    </div>
  );
}
