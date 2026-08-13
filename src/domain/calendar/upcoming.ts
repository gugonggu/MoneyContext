import { nextOccurrenceDate } from "@/domain/recurring/schedule";
import { assertIsoDate } from "@/lib/dates/seoul";

import type { UpcomingKind, UpcomingMarker } from "./types";

// DAILY 규칙이 아주 오래 전에 시작한 경우를 대비한 안전장치.
// 정상 범위(6주 그리드)에서는 닿을 수 없는 값이다.
const MAX_RECURRENCE_STEPS = 4_000;

export type UpcomingPlanned = Readonly<{
  scheduledDate: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  baseAmount?: number;
  memo?: string;
}>;

export type UpcomingCard = Readonly<{ accountId: string; accountName: string; paymentDay: number }>;

export type UpcomingRecurringRule = Readonly<{
  id: string;
  memo?: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  intervalCount: number;
  dayOfMonth?: number;
  /** 이 날짜 이전 발생분은 이미 확정 거래로 생성되어 있다. */
  nextRunDate: string;
  endDate?: string;
}>;

export type UpcomingInput = Readonly<{
  rangeStart: string;
  rangeEnd: string;
  planned: readonly UpcomingPlanned[];
  cards: readonly UpcomingCard[];
  recurringRules: readonly UpcomingRecurringRule[];
  confirmedRecurringDates: readonly Readonly<{ ruleId: string; date: string }>[];
}>;

const KIND_ORDER: Record<UpcomingKind, number> = { CARD_PAYMENT: 0, RECURRING: 1, PLANNED: 2 };

function push(target: Map<string, UpcomingMarker[]>, date: string, marker: UpcomingMarker): void {
  const bucket = target.get(date) ?? [];
  bucket.push(marker);
  target.set(date, bucket);
}

function lastDayOfMonth(year: number, month: number): number {
  const date = new Date(0);
  // Date.UTC would coerce years 0..99 to 1900..1999.
  date.setUTCFullYear(year, month, 0);
  return date.getUTCDate();
}

function cardPaymentDates(rangeStart: string, rangeEnd: string, paymentDay: number): string[] {
  const [startYear, startMonth] = assertIsoDate(rangeStart);
  const [endYear, endMonth] = assertIsoDate(rangeEnd);
  const dates: string[] = [];

  for (let year = startYear, month = startMonth; year * 12 + month <= endYear * 12 + endMonth; month += 1) {
    if (month === 13) {
      year += 1;
      month = 1;
    }
    const day = Math.min(paymentDay, lastDayOfMonth(year, month));
    const date = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (date >= rangeStart && date <= rangeEnd) dates.push(date);
  }

  return dates;
}

function recurrenceDates(rule: UpcomingRecurringRule, rangeStart: string, rangeEnd: string): string[] {
  const dates: string[] = [];
  let cursor = rule.nextRunDate;

  for (let step = 0; step < MAX_RECURRENCE_STEPS; step += 1) {
    if (cursor > rangeEnd) break;
    if (rule.endDate && cursor > rule.endDate) break;
    if (cursor >= rangeStart) dates.push(cursor);

    cursor = nextOccurrenceDate({
      frequency: rule.frequency,
      intervalCount: rule.intervalCount,
      dayOfMonth: rule.dayOfMonth,
      occurrenceDate: cursor,
    });
  }

  return dates;
}

/**
 * 달력의 각 칸에 보일 미래 항목을 날짜별로 모은다.
 * 반환값은 표시 전용이며 실제 수입·지출 또는 예산 통계에 포함되지 않는다.
 */
export function collectUpcomingMarkers(input: UpcomingInput): ReadonlyMap<string, readonly UpcomingMarker[]> {
  const markers = new Map<string, UpcomingMarker[]>();

  for (const planned of input.planned) {
    if (planned.scheduledDate < input.rangeStart || planned.scheduledDate > input.rangeEnd) continue;
    push(markers, planned.scheduledDate, {
      kind: "PLANNED",
      label: planned.memo || (planned.type === "INCOME" ? "예정 수입" : "예정 지출"),
      amount: planned.baseAmount ?? planned.amount,
      direction: planned.type,
    });
  }

  for (const card of input.cards) {
    for (const date of cardPaymentDates(input.rangeStart, input.rangeEnd, card.paymentDay)) {
      // 금액은 청구 확정 시점까지 알 수 없으므로 표시하지 않는다.
      // 카드대금 납부는 소비가 아닌 현금흐름이므로 실제 지출 통계에는 포함되지 않는다.
      push(markers, date, { kind: "CARD_PAYMENT", label: `${card.accountName} 결제`, direction: "EXPENSE" });
    }
  }

  const alreadyGenerated = new Set(input.confirmedRecurringDates.map((item) => `${item.ruleId}:${item.date}`));
  for (const rule of input.recurringRules) {
    for (const date of recurrenceDates(rule, input.rangeStart, input.rangeEnd)) {
      if (alreadyGenerated.has(`${rule.id}:${date}`)) continue;
      push(markers, date, {
        kind: "RECURRING",
        label: rule.memo || (rule.type === "INCOME" ? "반복 수입" : "반복 지출"),
        amount: rule.amount,
        direction: rule.type,
      });
    }
  }

  for (const bucket of markers.values()) {
    bucket.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  }

  return markers;
}
