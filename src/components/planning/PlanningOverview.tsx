import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export function PlanningOverview({ overview }: Readonly<{ overview: { budget: { actualUsage: number; forecastUsage: number }; freeSpendable: number; goals: readonly { id: string; name: string; contributedAmount: number; remainingAmount: number; requiredMonthlyAmount: number }[] } }>) {
  const money = (amount: number) => amount.toLocaleString("ko-KR");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Plans" />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="text-sm font-medium text-slate-500">Free spendable</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{money(overview.freeSpendable)}</p>
        </Card>

        <Card>
          <h2 className="text-sm font-medium text-slate-500">Budget</h2>
          <div className="mt-2 flex flex-col gap-1 text-sm text-slate-700">
            <p>Actual: {money(overview.budget.actualUsage)}</p>
            <p>Forecast: {money(overview.budget.forecastUsage)}</p>
          </div>
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Savings goals</h2>
        <div className="flex flex-col gap-3">
          {overview.goals.map((goal) => {
            const total = goal.contributedAmount + goal.remainingAmount;
            const progress = total > 0 ? Math.min(100, Math.round((goal.contributedAmount / total) * 100)) : 0;
            return (
              <Card key={goal.id} className="flex flex-col gap-3">
                <h3 className="text-base font-semibold text-slate-900">{goal.name}</h3>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                  <p>Saved: {money(goal.contributedAmount)}</p>
                  <p>Remaining: {money(goal.remainingAmount)}</p>
                  <p>Required monthly: {money(goal.requiredMonthlyAmount)}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
