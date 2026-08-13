import "server-only";

import { buildCalendarMonth, gridRange, type SourceTransaction } from "@/domain/calendar/month";
import type { CalendarMonth } from "@/domain/calendar/types";
import {
  collectUpcomingMarkers,
  type UpcomingCard,
  type UpcomingPlanned,
  type UpcomingRecurringRule,
} from "@/domain/calendar/upcoming";

export type CalendarSourceData = Readonly<{
  transactions: readonly SourceTransaction[];
  planned: readonly UpcomingPlanned[];
  cards: readonly UpcomingCard[];
  recurringRules: readonly UpcomingRecurringRule[];
  confirmedRecurringDates: readonly Readonly<{ ruleId: string; date: string }>[];
}>;

export interface CalendarRepository {
  getSourceData(
    userId: string,
    range: Readonly<{ start: string; end: string }>,
  ): Promise<CalendarSourceData>;
}

export function createCalendarService(repository: CalendarRepository) {
  return {
    async getMonth(userId: string, year: number, month: number, today: string): Promise<CalendarMonth> {
      if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw new RangeError("month must be between 1 and 12");
      }
      if (!Number.isInteger(year) || year < 1970 || year > 9999) {
        throw new RangeError("year is out of range");
      }

      const range = gridRange(year, month);
      const data = await repository.getSourceData(userId, range);
      const upcoming = collectUpcomingMarkers({
        rangeStart: range.start,
        rangeEnd: range.end,
        planned: data.planned,
        cards: data.cards,
        recurringRules: data.recurringRules,
        confirmedRecurringDates: data.confirmedRecurringDates,
      });

      return buildCalendarMonth({
        year,
        month,
        today,
        transactions: data.transactions,
        upcoming,
      });
    },
  };
}
