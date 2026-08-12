import type { StatisticsOverview as StatisticsData } from "@/server/statistics/service";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { cx } from "@/components/ui/cx";

const money = (value: number) => value.toLocaleString("ko-KR");

function Breakdown({ title, values }: Readonly<{ title: string; values: StatisticsData["category"] }>) {
  const total = values.reduce((sum, item) => sum + item.amount, 0);

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {values.length ? (
        <ul className="flex flex-col gap-2">
          {values.map((item) => {
            const ratio = total > 0 ? Math.round((item.amount / total) * 100) : 0;
            return (
              <li key={item.name} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-slate-700">{item.name}</span>
                  <span className="shrink-0 font-medium tabular-nums text-slate-900">{money(item.amount)}원</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${ratio}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">집계된 거래가 없습니다.</p>
      )}
    </Card>
  );
}

export function StatisticsOverview({ statistics }: Readonly<{ statistics: StatisticsData }>) {
  const latest = statistics.monthly.at(-1);
  const momValue = statistics.monthOverMonth;
  const momClassName = momValue === null ? "text-slate-900" : momValue > 0 ? "text-negative-600" : momValue < 0 ? "text-positive-600" : "text-slate-900";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="통계" description="월별 흐름과 소비 패턴을 한눈에 확인하세요." />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex flex-col gap-1">
          <p className="text-xs font-medium text-slate-500">이번 달 수입 · 지출</p>
          <p className="text-lg font-semibold text-slate-900">
            {money(latest?.income ?? 0)}원 · {money(latest?.expense ?? 0)}원
          </p>
        </Card>
        <Card className="flex flex-col gap-1">
          <p className="text-xs font-medium text-slate-500">전월 대비 지출</p>
          <p className={cx("text-lg font-semibold", momClassName)}>
            {momValue === null ? "비교 데이터 없음" : `${momValue}%`}
          </p>
        </Card>
        <Card className="flex flex-col gap-1">
          <p className="text-xs font-medium text-slate-500">저축률</p>
          <p className="text-lg font-semibold text-slate-900">
            {statistics.savingsRate === null ? "계산 불가" : `${statistics.savingsRate}%`}
          </p>
        </Card>
      </section>

      <Card className="overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">최근 6개월 수입·지출</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
              <th className="py-2 pr-3 font-medium">월</th>
              <th className="py-2 pr-3 text-right font-medium">수입</th>
              <th className="py-2 pr-3 text-right font-medium">지출</th>
              <th className="py-2 text-right font-medium">순액</th>
            </tr>
          </thead>
          <tbody>
            {statistics.monthly.map((x) => (
              <tr key={x.key} className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-3 text-slate-700">{x.key}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{money(x.income)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{money(x.expense)}</td>
                <td
                  className={cx(
                    "py-2 text-right font-medium tabular-nums",
                    x.value > 0 ? "text-positive-600" : x.value < 0 ? "text-negative-600" : "text-slate-700",
                  )}
                >
                  {money(x.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Breakdown title="카테고리" values={statistics.category} />
        <Breakdown title="결제수단" values={statistics.paymentMethods} />
        <Breakdown title="고정/변동 지출" values={statistics.fixedVariable} />
        <Breakdown title="태그" values={statistics.tags} />
        <Breakdown title="요일별 지출" values={statistics.weekday} />
        <Breakdown title="월 주차별 지출" values={statistics.weekOfMonth} />
      </section>

      <Card className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-900">순자산</h2>
        {statistics.netWorthTrend.length ? (
          <ul className="flex flex-col gap-1.5">
            {statistics.netWorthTrend.map((x) => (
              <li key={x.month} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{x.month}</span>
                <span className="font-medium tabular-nums text-slate-900">{money(x.value)}원</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">현재 순자산 데이터가 없습니다.</p>
        )}
      </Card>
    </div>
  );
}
