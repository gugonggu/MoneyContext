import type { AssetOverview as AssetOverviewModel } from "@/server/assets/service";
import { ReconciliationForm, type ReconciliationAction } from "./ReconciliationForm";
const format = (amount: number) => amount.toLocaleString("ko-KR");
export function AssetOverview({ overview, action }: Readonly<{ overview: AssetOverviewModel; action: ReconciliationAction }>) {
  const groups = [["Bank accounts", overview.accounts.bank], ["Cash accounts", overview.accounts.cash], ["Debit cards", overview.accounts.debit], ["Liabilities", overview.accounts.liability]] as const;
  return <div>
    <section aria-label="Asset summary"><h1>Assets</h1><p>Liquid assets: {format(overview.liquidAssets)}</p><p>Liabilities: {format(overview.liabilities)}</p><p>Net worth: {format(overview.netWorth)}</p></section>
    {groups.map(([title, accounts]) => accounts.length ? <section key={title}><h2>{title}</h2>{accounts.map((account) => <article key={account.id}><h3>{account.name}</h3><p>{format(account.balance)}</p><ReconciliationForm accountId={account.id} accountName={account.name} action={action} /></article>)}</section> : null)}
    <section><h2>Credit cards</h2>{overview.cards.map((card) => <article key={card.id}><h3>{card.name}</h3><p>Outstanding: {format(card.outstanding)}</p><p>Available limit: {card.availableLimit === null ? "-" : format(card.availableLimit)}</p><p>Next payment: {card.nextPaymentDate ?? "-"}</p><ul>{card.installmentSchedule.map((payment) => <li key={payment.id}>{payment.scheduledDate} · {format(payment.principalAmount + payment.feeAmount)}</li>)}</ul></article>)}</section>
  </div>;
}
