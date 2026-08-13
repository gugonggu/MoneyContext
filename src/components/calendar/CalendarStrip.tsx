import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { cx } from "@/components/ui/cx";
import type { DashboardDay, HeatLevel } from "@/domain/calendar/types";

const HEAT_CLASSES: Record<HeatLevel, string> = {
  0: "bg-border-subtle",
  1: "bg-brand-500/25",
  2: "bg-brand-500/45",
  3: "bg-brand-500/70",
  4: "bg-brand-500",
};

function describe(day: DashboardDay): string {
  const [, month, date] = day.date.split("-").map(Number);
  const spend = day.expense > 0 ? `지출 ${day.expense.toLocaleString("ko-KR")}원` : "지출 없음";
  return `${month}월 ${date}일 ${spend}`;
}

export function CalendarStrip({ days }: Readonly<{ days: readonly DashboardDay[] }>) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-content-primary">최근 2주</h2>
        <Link href="/calendar" className="text-xs font-semibold text-brand-600 no-underline dark:text-brand-400">
          달력에서 보기
        </Link>
      </div>
      <div className="flex items-end gap-1">
        {days.map((day) => (
          <div
            key={day.date}
            data-strip-day={day.date}
            title={describe(day)}
            className={cx("h-8 flex-1 rounded-sm", HEAT_CLASSES[day.heatLevel])}
          />
        ))}
      </div>
    </Card>
  );
}
