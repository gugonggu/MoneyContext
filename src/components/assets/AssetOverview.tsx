import type { AssetOverview as AssetOverviewModel } from "@/server/assets/service";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { AccountRow } from "./AccountRow";
import { AddAccountForm, type AddAccountAction } from "./AddAccountForm";
import { CreditCardRow } from "./CreditCardRow";
import type { EditAccountAction } from "./EditAccountForm";
import type { EditCreditCardAction } from "./EditCreditCardForm";
import type { ReconciliationAction } from "./ReconciliationForm";

const format = (amount: number) => amount.toLocaleString("ko-KR");

export function AssetOverview({
  overview,
  action,
  addAccountAction,
  editAccountAction,
  editCreditCardAction,
}: Readonly<{
  overview: AssetOverviewModel;
  action: ReconciliationAction;
  addAccountAction: AddAccountAction;
  editAccountAction: EditAccountAction;
  editCreditCardAction: EditCreditCardAction;
}>) {
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

      <AddAccountForm bankAccounts={overview.accounts.bank} action={addAccountAction} />

      {groups.map(([title, accounts]) =>
        accounts.length ? (
          <section key={title} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-content-muted">{title}</h2>
            <div className="flex flex-col gap-2">
              {accounts.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  bankAccounts={overview.accounts.bank}
                  reconcileAction={action}
                  editAction={editAccountAction}
                />
              ))}
            </div>
          </section>
        ) : null,
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-content-muted">신용카드</h2>
        <div className="flex flex-col gap-3">
          {overview.cards.map((card) => (
            <CreditCardRow key={card.id} card={card} bankAccounts={overview.accounts.bank} editAction={editCreditCardAction} />
          ))}
        </div>
      </section>
    </div>
  );
}
