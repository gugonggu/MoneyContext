import type { DashboardData } from "@/server/dashboard/service";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export function DashboardOverview({ overview }: Readonly<{ overview: DashboardData }>) {
  const n = (x: number) => x.toLocaleString("ko-KR");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader title="Dashboard" />

      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="border-brand-100 bg-brand-50">
          <h2 className="text-sm font-medium text-brand-700">Free spendable</h2>
          <p className="mt-1 text-3xl font-bold tracking-tight text-brand-700 sm:text-4xl">{n(overview.freeSpendable)}</p>
        </Card>
        <Card className="border-brand-100 bg-brand-50">
          <h2 className="text-sm font-medium text-brand-700">Daily spendable</h2>
          <p className="mt-1 text-3xl font-bold tracking-tight text-brand-700 sm:text-4xl">{n(overview.dailySpendable)}</p>
        </Card>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-sm font-semibold text-positive-600">Income: {n(overview.income)}</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-slate-900">Expense: {n(overview.expense)}</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-slate-900">Budget usage: {n(overview.budgetUsage)}</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-slate-900">Liquid assets: {n(overview.liquidAssets)}</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-slate-900">Net worth: {n(overview.netWorth)}</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-slate-900">Card outstanding: {n(overview.cardOutstanding)}</p>
        </Card>
        <Card className="flex flex-col items-start gap-1">
          <span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
            Savings goals: {overview.savingsGoals}
          </span>
        </Card>
        <Card className="flex flex-col items-start gap-1">
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            Upcoming events: {overview.upcomingEvents}
          </span>
        </Card>
      </section>
    </div>
  );
}
