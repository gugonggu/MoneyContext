import type { StatisticsOverview as StatisticsData } from "@/server/statistics/service";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Ring } from "@/components/ui/Ring";
import { Sparkline } from "@/components/ui/Sparkline";
import { cx } from "@/components/ui/cx";

const money = (value: number) => value.toLocaleString("ko-KR");

function Breakdown({ title, values }: Readonly<{ title: string; values: StatisticsData["category"] }>) {
  const total = values.reduce((sum, item) => sum + item.amount, 0);

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-content-primary">{title}</h2>
      {values.length ? (
        <ul className="flex flex-col gap-2">
          {values.map((item) => {
            const ratio = total > 0 ? Math.round((item.amount / total) * 100) : 0;
            return (
              <li key={item.name} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-content-secondary">{item.name}</span>
                  <span className="shrink-0 font-medium tabular-nums text-content-primary">{money(item.amount)}원</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-base">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${ratio}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-content-muted">집계된 거래가 없습니다.</p>
      )}
    </Card>
  );
}

export function StatisticsOverview({ statistics }: Readonly<{ statistics: StatisticsData }>) {
  const latest = statistics.monthly.at(-1);
  const momValue = statistics.monthOverMonth;
  const momClassName =
    momValue === null
      ? "text-content-primary"
      : momValue > 0
        ? "text-negative-600"
        : momValue < 0
          ? "text-positive-600 dark:text-positive-500"
          : "text-content-primary";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="통계" description="월별 흐름과 소비 패턴을 한눈에 확인하세요." />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex flex-col gap-1">
          <p className="text-xs font-medium text-content-muted">이번 달 수입 · 지출</p>
          <p className="text-lg font-semibold text-content-primary">
            {money(latest?.income ?? 0)}원 · {money(latest?.expense ?? 0)}원
          </p>
        </Card>
        <Card className="flex flex-col gap-1">
          <p className="text-xs font-medium text-content-muted">전월 대비 지출</p>
          <p className={cx("text-lg font-semibold", momClassName)}>
            {momValue === null ? "비교 데이터 없음" : `${momValue}%`}
          </p>
        </Card>
        <Card className="flex flex-col gap-1">
          {statistics.savingsRate === null || statistics.savingsRate < 0 ? (
            <>
              <p className="text-xs font-medium text-content-muted">저축률</p>
              <p className={cx("text-lg font-semibold", statistics.savingsRate === null ? "text-content-primary" : "text-negative-600")}>
                {statistics.savingsRate === null ? "계산 불가" : `${statistics.savingsRate}%`}
              </p>
            </>
          ) : (
            <Ring
              ratio={statistics.savingsRate / 100}
              label="저축률"
              caption={statistics.monthOverMonth === null ? undefined : `전월 대비 지출 ${statistics.monthOverMonth}%`}
            />
          )}
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-content-primary">소비 구조</h2>
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-content-secondary">총 소비</span>
              <span className="font-medium tabular-nums text-content-primary">{money(statistics.spendComposition.totalExpenseBaseAmount)}원</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-content-secondary">예외 소비</span>
              <span className="font-medium tabular-nums text-content-primary">{money(statistics.spendComposition.exceptionalBaseAmount)}원</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-content-secondary">일회성 소비</span>
              <span className="font-medium tabular-nums text-content-primary">{money(statistics.spendComposition.oneTimeBaseAmount)}원</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-content-secondary">반복성 소비</span>
              <span className="font-medium tabular-nums text-content-primary">{money(statistics.spendComposition.natureBreakdown.RECURRING)}원</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-content-secondary">비정기 소비</span>
              <span className="font-medium tabular-nums text-content-primary">{money(statistics.spendComposition.natureBreakdown.IRREGULAR)}원</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-content-secondary">미분류 소비</span>
              <span className="font-medium tabular-nums text-content-primary">{money(statistics.spendComposition.natureBreakdown.UNKNOWN)}원</span>
            </div>
          </div>
        </Card>
        <Card className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-content-primary">지출 집중도</h2>
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-content-secondary">상위 1건 비중</span>
              <span className="font-medium tabular-nums text-content-primary">
                {statistics.concentration.top1Share === null ? "계산 불가" : `${Math.round(statistics.concentration.top1Share * 100)}%`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-content-secondary">상위 3건 비중</span>
              <span className="font-medium tabular-nums text-content-primary">
                {statistics.concentration.top3Share === null ? "계산 불가" : `${Math.round(statistics.concentration.top3Share * 100)}%`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-content-secondary">상위 5건 비중</span>
              <span className="font-medium tabular-nums text-content-primary">
                {statistics.concentration.top5Share === null ? "계산 불가" : `${Math.round(statistics.concentration.top5Share * 100)}%`}
              </span>
            </div>
          </div>
          {statistics.concentration.topTransactions.length ? (
            <ul className="flex flex-col gap-1.5 border-t border-border-subtle pt-2">
              {statistics.concentration.topTransactions.map((item, index) => (
                <li key={`${item.label}-${index}`} className="flex items-center justify-between text-sm">
                  <span className="min-w-0 truncate text-content-secondary">{item.label}</span>
                  <span className="shrink-0 font-medium tabular-nums text-content-primary">{money(item.baseAmount)}원</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-content-muted">이번 달 주요 대형 거래가 없습니다.</p>
          )}
        </Card>
      </section>

      <Card className="overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold text-content-primary">최근 6개월 수입·지출</h2>
        <div className="mb-3 text-brand-500">
          <Sparkline
            values={statistics.monthly.map((point) => point.expense)}
            label={`최근 ${statistics.monthly.length}개월 지출 추세`}
          />
        </div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs font-medium text-content-muted">
              <th className="py-2 pr-3 font-medium">월</th>
              <th className="py-2 pr-3 text-right font-medium">수입</th>
              <th className="py-2 pr-3 text-right font-medium">지출</th>
              <th className="py-2 text-right font-medium">순액</th>
            </tr>
          </thead>
          <tbody>
            {statistics.monthly.map((x) => (
              <tr key={x.key} className="border-b border-border-subtle last:border-0">
                <td className="py-2 pr-3 text-content-secondary">{x.key}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-content-secondary">{money(x.income)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-content-secondary">{money(x.expense)}</td>
                <td
                  className={cx(
                    "py-2 text-right font-medium tabular-nums",
                    x.value > 0
                      ? "text-positive-600 dark:text-positive-500"
                      : x.value < 0
                        ? "text-negative-600"
                        : "text-content-secondary",
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
        <h2 className="text-sm font-semibold text-content-primary">순자산</h2>
        {statistics.netWorthTrend.length ? (
          <>
            <div className="text-positive-600 dark:text-positive-500">
              <Sparkline
                values={statistics.netWorthTrend.map((point) => point.value)}
                label={`최근 ${statistics.netWorthTrend.length}개월 순자산 추세`}
              />
            </div>
            <ul className="flex flex-col gap-1.5">
              {statistics.netWorthTrend.map((x) => (
                <li key={x.month} className="flex items-center justify-between text-sm">
                  <span className="text-content-secondary">{x.month}</span>
                  <span className="font-medium tabular-nums text-content-primary">{money(x.value)}원</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-content-muted">현재 순자산 데이터가 없습니다.</p>
        )}
      </Card>

      <details className="rounded-tile border border-border-subtle p-4">
        <summary className="cursor-pointer text-sm font-medium text-content-secondary">더 보기 (조정 소비 · 사용 가능 금액)</summary>
        <div className="mt-3 flex flex-col gap-2 text-sm text-content-secondary">
          <p>조정 소비(예외 제외): {statistics.spendComposition.adjustedExpenseBaseAmount.toLocaleString()}원</p>
          {statistics.safeToSpend ? (
            <>
              <p>다음 급여일({statistics.safeToSpend.nextPaydayDate})까지 사용 가능 금액: {statistics.safeToSpend.amount.toLocaleString()}원</p>
              <p>일평균 사용 가능 금액(참고): {statistics.safeToSpend.dailyAmount.toLocaleString()}원</p>
              <p>주간 사용 가능 금액(참고): {statistics.safeToSpend.weeklyAmount.toLocaleString()}원</p>
            </>
          ) : (
            <p>급여일과 비상금을 설정에서 등록하면 사용 가능 금액을 볼 수 있어요.</p>
          )}
        </div>
      </details>
    </div>
  );
}
