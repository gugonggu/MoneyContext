import type { AssetOverview as AssetOverviewModel } from "@/server/assets/service";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReconciliationForm, type ReconciliationAction } from "./ReconciliationForm";

const format = (amount: number) => amount.toLocaleString("ko-KR");

export function AssetOverview({ overview, action }: Readonly<{ overview: AssetOverviewModel; action: ReconciliationAction }>) {
  const groups = [
    ["Bank accounts", overview.accounts.bank],
    ["Cash accounts", overview.accounts.cash],
    ["Debit cards", overview.accounts.debit],
    ["Liabilities", overview.accounts.liability],
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Assets" />

      <section aria-label="Asset summary">
        <Card className="border-brand-100 bg-brand-50">
          <p className="text-sm font-medium text-brand-700">Net worth: {format(overview.netWorth)}</p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-brand-100 pt-3 text-sm text-slate-600">
            <p>Liquid assets: {format(overview.liquidAssets)}</p>
            <p>Liabilities: {format(overview.liabilities)}</p>
          </div>
        </Card>
      </section>

      {groups.map(([title, accounts]) =>
        accounts.length ? (
          <section key={title} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
            <div className="flex flex-col gap-2">
              {accounts.map((account) => (
                <Card key={account.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center justify-between gap-3 sm:flex-1">
                    <h3 className="text-sm font-medium text-slate-900">{account.name}</h3>
                    <p className="text-lg font-bold tracking-tight text-slate-900">{format(account.balance)}</p>
                  </div>
                  <ReconciliationForm accountId={account.id} accountName={account.name} action={action} />
                </Card>
              ))}
            </div>
          </section>
        ) : null,
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Credit cards</h2>
        <div className="flex flex-col gap-3">
          {overview.cards.map((card) => (
            <Card key={card.id} className="border-slate-800 bg-slate-900 text-white">
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-medium text-slate-300">{card.name}</h3>
                <div>
                  <p className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    Outstanding: {format(card.outstanding)}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Available limit: {card.availableLimit === null ? "-" : format(card.availableLimit)}
                  </p>
                </div>
                <p className="text-sm text-slate-400">Next payment: {card.nextPaymentDate ?? "-"}</p>
                {card.installmentSchedule.length ? (
                  <ul className="flex flex-col gap-1 border-t border-slate-700 pt-2 text-sm text-slate-300">
                    {card.installmentSchedule.map((payment) => (
                      <li key={payment.id}>
                        {payment.scheduledDate} · {format(payment.principalAmount + payment.feeAmount)}
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
