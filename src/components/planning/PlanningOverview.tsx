import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export function PlanningOverview({ overview }: Readonly<{ overview: { budget: { actualUsage: number; forecastUsage: number }; freeSpendable: number; goals: readonly { id: string; name: string; contributedAmount: number; remainingAmount: number; requiredMonthlyAmount: number }[] } }>) {
  const money = (amount: number) => amount.toLocaleString("ko-KR");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="계획" />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="bg-gradient-to-br from-brand-50 to-brand-100/60 border-brand-100 dark:border-brand-500/20 dark:from-brand-500/10 dark:to-brand-500/5">
          <h2 className="text-sm font-medium text-brand-700 dark:text-brand-300">여유 지출액</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-brand-700 dark:text-brand-300">{money(overview.freeSpendable)}원</p>
        </Card>

        <Card>
          <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400">예산</h2>
          <div className="mt-2 flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-300">
            <p>실제 {money(overview.budget.actualUsage)}원</p>
            <p>예상 {money(overview.budget.forecastUsage)}원</p>
          </div>
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">저축 목표</h2>
        <div className="flex flex-col gap-3">
          {overview.goals.map((goal) => {
            const total = goal.contributedAmount + goal.remainingAmount;
            const progress = total > 0 ? Math.min(100, Math.round((goal.contributedAmount / total) * 100)) : 0;
            return (
              <Card key={goal.id} className="flex flex-col gap-3">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{goal.name}</h3>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-brand-600 dark:bg-brand-500" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
                  <p>저축액 {money(goal.contributedAmount)}원</p>
                  <p>남은 금액 {money(goal.remainingAmount)}원</p>
                  <p>월 필요액 {money(goal.requiredMonthlyAmount)}원</p>
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
