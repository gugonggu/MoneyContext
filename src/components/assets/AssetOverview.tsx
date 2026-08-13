import type { AssetOverview as AssetOverviewModel } from "@/server/assets/service";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Ring } from "@/components/ui/Ring";
import { creditUsageRatio } from "@/domain/cards/outstanding";
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
        <Card variant="gradient">
          <h2 className="text-sm font-medium text-white/80">순자산</h2>
          <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">{format(overview.netWorth)}원</p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-white/20 pt-3 text-sm text-white/80">
            <p>유동 자산 {format(overview.liquidAssets)}원</p>
            <p>부채 {format(overview.liabilities)}원</p>
          </div>
        </Card>
      </section>

      {groups.map(([title, accounts]) =>
        accounts.length ? (
          <section key={title} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-content-muted">{title}</h2>
            <div className="flex flex-col gap-2">
              {accounts.map((account) => (
                <Card key={account.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center justify-between gap-3 sm:flex-1">
                    <h3 className="text-sm font-medium text-content-primary">{account.name}</h3>
                    <p className="text-lg font-bold tracking-tight text-content-primary">{format(account.balance)}원</p>
                  </div>
                  <ReconciliationForm accountId={account.id} accountName={account.name} action={action} />
                </Card>
              ))}
            </div>
          </section>
        ) : null,
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-content-muted">신용카드</h2>
        <div className="flex flex-col gap-3">
          {overview.cards.map((card) => {
            const ratio = creditUsageRatio(card.outstanding, card.availableLimit);

            return (
              <Card key={card.id} className="border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-medium text-white/80">{card.name}</h3>
                    <div>
                      <p className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                        미결제액 {format(card.outstanding)}원
                      </p>
                    </div>
                    <p className="text-sm text-white/60">다음 결제일 {card.nextPaymentDate ?? "-"}</p>
                    {card.installmentSchedule.length ? (
                      <ul className="flex flex-col gap-1 border-t border-white/20 pt-2 text-sm text-white/80">
                        {card.installmentSchedule.map((payment) => (
                          <li key={payment.id}>
                            {payment.scheduledDate} · {format(payment.paymentAmount)}원
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  {ratio === null ? null : (
                    <Ring ratio={ratio} label="한도 사용률" caption={`남은 한도 ${format(card.availableLimit ?? 0)}원`} />
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
