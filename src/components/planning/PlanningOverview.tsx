export function PlanningOverview({ overview }: Readonly<{ overview: { budget: { actualUsage: number; forecastUsage: number }; freeSpendable: number; goals: readonly { id: string; name: string; contributedAmount: number; remainingAmount: number; requiredMonthlyAmount: number }[] } }>) {
  const money = (amount: number) => amount.toLocaleString("ko-KR");
  return <div>
    <h1>Plans</h1>
    <section><h2>Free spendable</h2><p>{money(overview.freeSpendable)}</p></section>
    <section><h2>Budget</h2><p>Actual: {money(overview.budget.actualUsage)}</p><p>Forecast: {money(overview.budget.forecastUsage)}</p></section>
    <section><h2>Savings goals</h2>{overview.goals.map((goal) => <article key={goal.id}><h3>{goal.name}</h3><p>Saved: {money(goal.contributedAmount)}</p><p>Remaining: {money(goal.remainingAmount)}</p><p>Required monthly: {money(goal.requiredMonthlyAmount)}</p></article>)}</section>
  </div>;
}
