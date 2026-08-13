"use client";

import Link from "next/link";

import { Sheet } from "@/components/ui/Sheet";
import type { CalendarCell } from "@/domain/calendar/types";

const won = (value: number) => `${value.toLocaleString("ko-KR")}원`;

function titleFor(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

export function CalendarDaySheet({ cell, onClose }: Readonly<{ cell: CalendarCell | null; onClose: () => void }>) {
  return (
    <Sheet open={cell !== null} onClose={onClose} title={cell ? titleFor(cell.date) : ""}>
      {cell ? (
        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-2 gap-2">
            <div className="rounded-tile bg-surface-base p-3">
              <dt className="text-xs text-content-secondary">수입</dt>
              <dd className="text-base font-bold tabular-nums text-positive-600 dark:text-positive-500">
                {won(cell.income)}
              </dd>
            </div>
            <div className="rounded-tile bg-surface-base p-3">
              <dt className="text-xs text-content-secondary">지출</dt>
              <dd className="text-base font-bold tabular-nums text-content-primary">{won(cell.expense)}</dd>
            </div>
          </dl>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-bold text-content-primary">확정 거래</h3>
            {cell.transactions.length === 0 ? (
              <p className="text-sm text-content-muted">이 날 기록된 거래가 없어요.</p>
            ) : (
              <ul className="flex list-none flex-col gap-2 p-0">
                {cell.transactions.map((transaction) => (
                  <li key={transaction.id}>
                    <Link
                      href={`/transactions/${transaction.id}/edit`}
                      className="flex items-start justify-between gap-3 rounded-tile border border-border-subtle p-3 no-underline hover:bg-surface-base"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-content-primary">
                          {transaction.memo || transaction.categoryName || "거래"}
                        </span>
                        <span className="block truncate text-xs text-content-muted">
                          {[transaction.categoryName, transaction.accountName].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span
                        className={
                          transaction.type === "INCOME"
                            ? "shrink-0 text-sm font-bold tabular-nums text-positive-600 dark:text-positive-500"
                            : "shrink-0 text-sm font-bold tabular-nums text-content-primary"
                        }
                      >
                        {transaction.type === "INCOME" ? "+" : "-"}
                        {transaction.baseAmount.toLocaleString("ko-KR")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {cell.upcoming.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-content-primary">예정</h3>
              <p className="text-xs text-content-muted">아직 확정되지 않아 수입·지출 합계에는 포함되지 않아요.</p>
              <ul className="flex list-none flex-col gap-2 p-0">
                {cell.upcoming.map((marker, index) => (
                  <li
                    key={`${marker.kind}-${index}`}
                    className="flex items-start justify-between gap-3 rounded-tile border border-dashed border-border-strong p-3"
                  >
                    <span className="min-w-0 truncate text-sm text-content-secondary">{marker.label}</span>
                    {marker.amount !== undefined ? (
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-content-muted">
                        {marker.direction === "INCOME" ? "+" : "-"}
                        {marker.amount.toLocaleString("ko-KR")}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <Link
            href={`/transactions/new?date=${cell.date}`}
            className="inline-flex items-center justify-center rounded-tile bg-gradient-to-br from-brand-600 to-brand-500 px-4 py-2.5 text-sm font-semibold text-white no-underline shadow-card"
          >
            이 날짜로 기록
          </Link>
        </div>
      ) : null}
    </Sheet>
  );
}
