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
  overview: {
    budget: { actualUsage: number; forecastUsage: number; allocated: number | null };
    freeSpendable: number;
    futureCashflowCount: number;
    futureCashflows: readonly { id: string; label: string; amount: number; status: "CONFIRMED" | "PLANNED" }[];
    goals: readonly { id: string; name: string; contributedAmount: number; remainingAmount: number; requiredMonthlyAmount: number; progressPercent: number }[];
  };
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
            <h2 className="text-sm font-medium text-content-muted">이번 달 예산</h2>
            <div className="mt-2 flex flex-col gap-1 text-sm text-content-secondary">
              {overview.budget.allocated !== null ? (
                <p>
                  예산 {money(overview.budget.allocated)}원 중 {money(overview.budget.actualUsage)}원 사용
                  {overview.budget.allocated > 0 ? ` (${Math.round((overview.budget.actualUsage / overview.budget.allocated) * 100)}%)` : ""}
                </p>
              ) : (
                <>
                  <p>실제 {money(overview.budget.actualUsage)}원</p>
                  <p className="text-xs text-content-muted">이번 달 예산이 아직 설정되지 않았습니다.</p>
                </>
              )}
              <p>예상(이번 달 남은 예정 지출 포함) {money(overview.budget.forecastUsage)}원</p>
            </div>
          </Card>
          {budgetForms}
        </section>
      ) : null}

      {section === "goals" ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-content-primary">저축 목표</h2>
          <div className="flex flex-col gap-3">
            {overview.goals.map((goal) => (
              <Card key={goal.id} className="flex flex-col gap-3">
                <h3 className="text-base font-semibold text-content-primary">{goal.name}</h3>
                <div
                  role="progressbar"
                  aria-label={`${goal.name} 진행률`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={goal.progressPercent}
                  className="h-2 w-full overflow-hidden rounded-full bg-surface-base"
                >
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${goal.progressPercent}%` }} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-content-secondary">
                  <p>저축액 {money(goal.contributedAmount)}원</p>
                  <p>남은 금액 {money(goal.remainingAmount)}원</p>
                  <p>월 필요액 {money(goal.requiredMonthlyAmount)}원</p>
                </div>
              </Card>
            ))}
          </div>
          {savingsForms}
        </section>
      ) : null}

      {section === "cashflow" ? (
        <section className="flex flex-col gap-4">
          <Card variant="gradient">
            <h2 className="text-sm font-medium text-white/80">여유 지출액</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">{money(overview.freeSpendable)}원</p>
            <p className="mt-3 border-t border-white/20 pt-3 text-sm text-white/80">예정된 현금흐름 {overview.futureCashflowCount}건</p>
          </Card>
          <Card>
            <ul className="flex flex-col gap-2">
              {overview.futureCashflows.map((item) => (
                <li
                  key={`${item.status}:${item.id}`}
                  className={`flex items-center justify-between gap-3 rounded-tile border p-3 ${item.status === "CONFIRMED" ? "border-solid border-border-strong" : "border-dashed border-border-subtle"}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-content-primary">{item.label}</p>
                    <p className="text-xs text-content-muted">{item.status === "CONFIRMED" ? "확정" : "예정"}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-content-primary">-{money(item.amount)}원</p>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
