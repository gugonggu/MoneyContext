import { notFound, redirect } from "next/navigation";

import { EditTransactionForm, type EditTransactionState } from "@/components/transactions/EditTransactionForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { seoulWallClockToUtcIso, utcIsoToSeoulWallClock } from "@/lib/dates/seoul";
import { listAccountsForCurrentUser } from "@/server/accounts";
import { listCategoriesForCurrentUser } from "@/server/categories";
import { getTransactionForCurrentUser, updateTransactionForCurrentUser } from "@/server/transactions";

async function submitEdit(id: string, _previous: EditTransactionState, formData: FormData): Promise<EditTransactionState> {
  "use server";

  try {
    const type = String(formData.get("type")) as "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT";
    const amountRaw = String(formData.get("amount") ?? "");
    if (!/^\d+$/.test(amountRaw)) throw new Error("금액을 올바르게 입력해주세요");
    const amount = Number(amountRaw);

    const currency = String(formData.get("currency") ?? "KRW");
    const exchangeRateRaw = formData.get("exchangeRate");
    const exchangeRate = exchangeRateRaw ? String(exchangeRateRaw) : undefined;
    const baseAmount = currency === "KRW" ? amount : Math.round(amount * Number(exchangeRate ?? "0"));
    const memo = String(formData.get("memo") ?? "").trim() || undefined;

    const existing = await getTransactionForCurrentUser(id);
    const transactionAtRaw = String(formData.get("transactionAt") ?? "");
    const transactionAt = transactionAtRaw ? seoulWallClockToUtcIso(transactionAtRaw) : existing.transactionAt;

    if (type === "TRANSFER") {
      const fromAccountId = String(formData.get("fromAccountId"));
      const toAccountId = String(formData.get("toAccountId"));
      await updateTransactionForCurrentUser(id, {
        type: "TRANSFER",
        amount,
        baseAmount,
        currency,
        transactionAt,
        fromAccountId,
        toAccountId,
        memo,
      });
    } else {
      const categoryId = String(formData.get("categoryId") ?? "") || undefined;
      const accountId = String(formData.get("accountId"));
      // The 소비 성격 select is always rendered for EXPENSE transactions (never omitted),
      // so a blank value ("지정 안 함") is a real, explicit user choice to clear the
      // MANUAL classification back to UNSET — not an "unchanged" signal like transactionAt.
      const expenseNatureUserRaw = String(formData.get("expenseNatureUser") ?? "");
      const expenseNatureUser = expenseNatureUserRaw
        ? (expenseNatureUserRaw as "RECURRING" | "ONE_TIME" | "IRREGULAR" | "EXCEPTIONAL" | "UNKNOWN")
        : undefined;
      await updateTransactionForCurrentUser(id, {
        type: type as "INCOME" | "EXPENSE",
        amount,
        baseAmount,
        currency,
        transactionAt,
        accountId,
        categoryId,
        exchangeRate,
        memo,
        expenseNatureUser,
      });
    }
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "수정에 실패했습니다." };
  }

  redirect("/transactions");
}

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const transaction = await getTransactionForCurrentUser(id).catch(() => null);
  if (!transaction) notFound();

  const [accounts, categories] = await Promise.all([listAccountsForCurrentUser(), listCategoriesForCurrentUser()]);

  return (
    <div>
      <PageHeader title="거래 수정" />
      <EditTransactionForm
        transaction={{
          id: transaction.id,
          type: transaction.type,
          amount: transaction.amount,
          currency: transaction.currency,
          exchangeRate: transaction.exchangeRate,
          accountId: transaction.accountId,
          fromAccountId: transaction.fromAccountId,
          toAccountId: transaction.toAccountId,
          categoryId: transaction.categoryId,
          memo: transaction.memo,
          expenseNatureUser: transaction.expenseNatureUser,
          transactionAtLocal: utcIsoToSeoulWallClock(transaction.transactionAt),
        }}
        accounts={accounts.map((account) => ({ id: account.id, name: account.name, type: account.type }))}
        categories={categories.map((category) => ({ id: category.id, name: category.name, kind: category.kind }))}
        action={submitEdit.bind(null, id)}
      />
    </div>
  );
}
