import { CalendarStrip } from "@/components/calendar/CalendarStrip";
import { Stagger } from "@/components/motion/Stagger";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sparkline } from "@/components/ui/Sparkline";
import { StatTile } from "@/components/ui/StatTile";
import type { DashboardData } from "@/server/dashboard/service";

const won = (value: number) => `${value.toLocaleString("ko-KR")}원`;

export function DashboardOverview({ overview }: Readonly<{ overview: DashboardData }>) {
  const spendTrend = overview.recentDays.map((day) => day.expense);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="대시보드" />

      <Stagger className="flex flex-col gap-5">
        <Card variant="gradient" className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <h2 className="text-sm font-medium text-white/80">여유 지출액</h2>
              <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">{won(overview.freeSpendable)}</p>
            </div>
            <div>
              <h2 className="text-sm font-medium text-white/80">일일 지출 가능액</h2>
              <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">{won(overview.dailySpendable)}</p>
            </div>
          </div>
          {spendTrend.length > 0 ? (
            <div className="text-white/70">
              <Sparkline values={spendTrend} label={`최근 ${spendTrend.length}일 지출 추세`} />
            </div>
          ) : null}
        </Card>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile variant="glass" label="수입" value={won(overview.income)} tone="positive" />
          <StatTile variant="glass" label="지출" value={won(overview.expense)} />
          <StatTile variant="glass" label="예산 사용액" value={won(overview.budgetUsage)} />
          <StatTile variant="glass" label="유동 자산" value={won(overview.liquidAssets)} />
          <StatTile variant="glass" label="순자산" value={won(overview.netWorth)} />
          <StatTile variant="glass" label="카드 미결제액" value={won(overview.cardOutstanding)} />
        </section>

        <CalendarStrip days={overview.recentDays} />

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card variant="glass">
            <p className="text-sm font-semibold text-content-primary">저축 목표 {overview.savingsGoals}개</p>
          </Card>
          <Card variant="glass">
            <p className="text-sm font-semibold text-content-primary">예정된 일정 {overview.upcomingEvents}건</p>
          </Card>
        </section>
      </Stagger>
    </div>
  );
}
