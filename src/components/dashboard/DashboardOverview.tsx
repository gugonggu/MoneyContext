import type { DashboardData } from "@/server/dashboard/service";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export function DashboardOverview({ overview }: Readonly<{ overview: DashboardData }>) {
  const n = (x: number) => x.toLocaleString("ko-KR");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader title="대시보드" />

      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="border-brand-100 bg-gradient-to-br from-brand-50 to-brand-100/60 dark:border-brand-500/20 dark:from-brand-500/10 dark:to-brand-500/5">
          <h2 className="text-sm font-medium text-brand-700 dark:text-brand-300">여유 지출액</h2>
          <p className="mt-1 text-3xl font-bold tracking-tight text-brand-700 sm:text-4xl dark:text-brand-300">{n(overview.freeSpendable)}원</p>
        </Card>
        <Card className="border-brand-100 bg-gradient-to-br from-brand-50 to-brand-100/60 dark:border-brand-500/20 dark:from-brand-500/10 dark:to-brand-500/5">
          <h2 className="text-sm font-medium text-brand-700 dark:text-brand-300">일일 지출 가능액</h2>
          <p className="mt-1 text-3xl font-bold tracking-tight text-brand-700 sm:text-4xl dark:text-brand-300">{n(overview.dailySpendable)}원</p>
        </Card>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-sm font-semibold text-positive-600 dark:text-positive-500">수입 {n(overview.income)}원</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">지출 {n(overview.expense)}원</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">예산 사용액 {n(overview.budgetUsage)}원</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">유동 자산 {n(overview.liquidAssets)}원</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">순자산 {n(overview.netWorth)}원</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">카드 미결제액 {n(overview.cardOutstanding)}원</p>
        </Card>
        <Card className="flex flex-col items-start gap-1">
          <span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            저축 목표 {overview.savingsGoals}개
          </span>
        </Card>
        <Card className="flex flex-col items-start gap-1">
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            예정된 일정 {overview.upcomingEvents}건
          </span>
        </Card>
      </section>
    </div>
  );
}
