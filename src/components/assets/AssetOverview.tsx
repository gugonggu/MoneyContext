import type { AssetOverview as AssetOverviewModel } from "@/server/assets/service";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReconciliationForm, type ReconciliationAction } from "./ReconciliationForm";

const format = (amount: number) => amount.toLocaleString("ko-KR");

export function AssetOverview({ overview, action }: Readonly<{ overview: AssetOverviewModel; action: ReconciliationAction }>) {
  const groups = [
    ["은행 계좌", overview.accounts.bank],
    ["현금", overview.accounts.cash],
    ["체크카드", overview.accounts.debit],
    ["부채", overview.accounts.liability],
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="자산" />

      <section aria-label="자산 요약">
        <Card className="border-brand-100 bg-gradient-to-br from-brand-50 to-brand-100/60 dark:border-brand-500/20 dark:from-brand-500/10 dark:to-brand-500/5">
          <p className="text-sm font-medium text-brand-700 dark:text-brand-300">순자산 {format(overview.netWorth)}원</p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-brand-100 pt-3 text-sm text-slate-600 dark:border-brand-500/20 dark:text-slate-400">
            <p>유동 자산 {format(overview.liquidAssets)}원</p>
            <p>부채 {format(overview.liabilities)}원</p>
          </div>
        </Card>
      </section>

      {groups.map(([title, accounts]) =>
        accounts.length ? (
          <section key={title} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h2>
            <div className="flex flex-col gap-2">
              {accounts.map((account) => (
                <Card key={account.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center justify-between gap-3 sm:flex-1">
                    <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">{account.name}</h3>
                    <p className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">{format(account.balance)}원</p>
                  </div>
                  <ReconciliationForm accountId={account.id} accountName={account.name} action={action} />
                </Card>
              ))}
            </div>
          </section>
        ) : null,
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">신용카드</h2>
        <div className="flex flex-col gap-3">
          {overview.cards.map((card) => (
            <Card key={card.id} className="border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800 text-white dark:border-slate-700">
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-medium text-slate-300">{card.name}</h3>
                <div>
                  <p className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    미결제액 {format(card.outstanding)}원
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    사용 가능 한도 {card.availableLimit === null ? "-" : `${format(card.availableLimit)}원`}
                  </p>
                </div>
                <p className="text-sm text-slate-400">다음 결제일 {card.nextPaymentDate ?? "-"}</p>
                {card.installmentSchedule.length ? (
                  <ul className="flex flex-col gap-1 border-t border-slate-700 pt-2 text-sm text-slate-300">
                    {card.installmentSchedule.map((payment) => (
                      <li key={payment.id}>
                        {payment.scheduledDate} · {format(payment.principalAmount + payment.feeAmount)}원
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
