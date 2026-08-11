import { QuickEntryForm, type QuickEntryState } from "@/components/transactions/QuickEntryForm";
import { listAccountsForCurrentUser } from "@/server/accounts";
import { assignTagForCurrentUser, listCategoriesForCurrentUser, listTagsForCurrentUser } from "@/server/categories";
import { createInstallmentPurchaseForCurrentUser } from "@/server/installments";
import { createTransactionForCurrentUser } from "@/server/transactions";

async function submitQuickEntry(_previous: QuickEntryState, formData: FormData): Promise<QuickEntryState> {
  "use server";

  try {
    const type = String(formData.get("type"));
    const amountRaw = String(formData.get("amount") ?? "");
    if (!/^\d+$/.test(amountRaw)) throw new Error("금액을 올바르게 입력해주세요");
    const amount = Number(amountRaw);

    const currency = String(formData.get("currency") ?? "KRW");
    const exchangeRateRaw = formData.get("exchangeRate");
    const exchangeRate = exchangeRateRaw ? String(exchangeRateRaw) : undefined;
    const baseAmount = currency === "KRW" ? amount : Math.round(amount * Number(exchangeRate ?? "0"));

    const transactionAtRaw = String(formData.get("transactionAt") ?? "");
    const transactionAt = transactionAtRaw ? new Date(transactionAtRaw).toISOString() : new Date().toISOString();
    const memo = String(formData.get("memo") ?? "").trim() || undefined;
    const categoryId = String(formData.get("categoryId") ?? "") || undefined;
    const tagIds = formData.getAll("tagIds").map(String);

    if (type === "TRANSFER") {
      const fromAccountId = String(formData.get("fromAccountId"));
      const toAccountId = String(formData.get("toAccountId"));
      await createTransactionForCurrentUser({ type: "TRANSFER", amount, baseAmount, currency, transactionAt, fromAccountId, toAccountId, memo });
      return { status: "success" };
    }

    const accountId = String(formData.get("accountId"));
    const isInstallment = type === "EXPENSE" && formData.get("installment") === "on";

    if (isInstallment) {
      const installmentCount = Number(String(formData.get("installmentCount") ?? ""));
      await createInstallmentPurchaseForCurrentUser({
        accountId,
        categoryId,
        transactionAt,
        amount,
        currency: "KRW",
        memo,
        installmentCount,
        interestType: "INTEREST_FREE",
        firstPaymentDate: transactionAt.slice(0, 10),
      });
      return { status: "success" };
    }

    const created = await createTransactionForCurrentUser({
      type: type as "INCOME" | "EXPENSE",
      amount,
      baseAmount,
      currency,
      transactionAt,
      accountId,
      categoryId,
      exchangeRate,
      memo,
    });

    for (const tagId of tagIds) {
      await assignTagForCurrentUser(created.id, tagId);
    }

    return { status: "success" };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "저장에 실패했습니다." };
  }
}

export default async function NewTransactionPage() {
  const [accounts, categories, tags] = await Promise.all([
    listAccountsForCurrentUser(),
    listCategoriesForCurrentUser(),
    listTagsForCurrentUser(),
  ]);

  return (
    <div>
      <h1>거래 입력</h1>
      <QuickEntryForm
        accounts={accounts.map((account) => ({ id: account.id, name: account.name, type: account.type }))}
        categories={categories.map((category) => ({ id: category.id, name: category.name, kind: category.kind }))}
        tags={tags.map((tag) => ({ id: tag.id, name: tag.name }))}
        action={submitQuickEntry}
      />
    </div>
  );
}
