"use client";

import { useState, type ReactNode } from "react";

import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";

const SECTIONS = [
  { value: "budget", label: "예산" },
  { value: "goals", label: "저축 목표" },
  { value: "cashflow", label: "미래 현금흐름" },
] as const;

type PlanningSection = (typeof SECTIONS)[number]["value"];

export function PlanningOverview({
  overview,
  budgetForms,
  savingsForms,
}: Readonly<{
  overview: { budget: { actualUsage: number; forecastUsage: number }; freeSpendable: number; futureCashflowCount: number; goals: readonly { id: string; name: string; contributedAmount: number; remainingAmount: number; requiredMonthlyAmount: number }[] };
  budgetForms?: ReactNode;
  savingsForms?: ReactNode;
}>) {
  const [section, setSection] = useState<PlanningSection>("budget");
  const money = (amount: number) => amount.toLocaleString("ko-KR");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="계획" />

      <Segmented
        label="계획 영역"
        options={SECTIONS}
        value={section}
        onChange={(value) => setSection(value as PlanningSection)}
        className="w-full sm:w-fit"
      />

      {section === "budget" ? (
        <section className="flex flex-col gap-4">
          <Card>
            <h2 className="text-sm font-medium text-content-muted">예산</h2>
            <div className="mt-2 flex flex-col gap-1 text-sm text-content-secondary">
              <p>실제 {money(overview.budget.actualUsage)}원</p>
              <p>예상 {money(overview.budget.forecastUsage)}원</p>
            </div>
          </Card>
          {budgetForms}
        </section>
      ) : null}

      {section === "goals" ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-content-primary">저축 목표</h2>
          <div className="flex flex-col gap-3">
            {overview.goals.map((goal) => {
              const total = goal.contributedAmount + goal.remainingAmount;
              const progress = total > 0 ? Math.min(100, Math.round((goal.contributedAmount / total) * 100)) : 0;
              return (
                <Card key={goal.id} className="flex flex-col gap-3">
                  <h3 className="text-base font-semibold text-content-primary">{goal.name}</h3>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-base">
                    <div className="h-full rounded-full bg-brand-600" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-content-secondary">
                    <p>저축액 {money(goal.contributedAmount)}원</p>
                    <p>남은 금액 {money(goal.remainingAmount)}원</p>
                    <p>월 필요액 {money(goal.requiredMonthlyAmount)}원</p>
                  </div>
                </Card>
              );
            })}
          </div>
          {savingsForms}
        </section>
      ) : null}

      {section === "cashflow" ? (
        <Card variant="gradient">
          <h2 className="text-sm font-medium text-white/80">여유 지출액</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">{money(overview.freeSpendable)}원</p>
          <p className="mt-3 border-t border-white/20 pt-3 text-sm text-white/80">예정된 현금흐름 {overview.futureCashflowCount}건</p>
        </Card>
      ) : null}
    </div>
  );
}
