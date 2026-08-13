import { CalendarMonthView } from "@/components/calendar/CalendarMonthView";
import { PageHeader } from "@/components/ui/PageHeader";
import { parseYearMonth } from "@/domain/calendar/month";
import { todayInSeoul } from "@/lib/dates/seoul";
import { getCalendarMonthForCurrentUser } from "@/server/calendar";

type RawSearchParams = Record<string, string | string[] | undefined>;

export default async function CalendarPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = await searchParams;
  const raw = params.ym;
  const ym = Array.isArray(raw) ? raw[0] : raw;
  const { year, month } = parseYearMonth(ym, todayInSeoul());
  const data = await getCalendarMonthForCurrentUser(year, month);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="달력" />
      <CalendarMonthView month={data} />
    </div>
  );
}
