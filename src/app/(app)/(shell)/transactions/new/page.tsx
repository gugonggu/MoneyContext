import { QuickEntryForm, type QuickEntryState } from "@/components/transactions/QuickEntryForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { parseDefaultTransactionDate } from "@/domain/transactions/default-date";
import { listAccountsForCurrentUser, listCreditCardSettingsForCurrentUser } from "@/server/accounts";
import { assignTagForCurrentUser, createCategoryForCurrentUser, listCategoriesForCurrentUser, listTagsForCurrentUser } from "@/server/categories";
import { createInstallmentPurchaseForCurrentUser } from "@/server/installments";
import { createTransactionForCurrentUser, listRecentTransactionsForPatterns } from "@/server/transactions";

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
      const fromAccountIdRaw = formData.get("fromAccountId");
      const toAccountIdRaw = formData.get("toAccountId");
      const fromAccountId = typeof fromAccountIdRaw === "string" && fromAccountIdRaw ? fromAccountIdRaw : undefined;
      const toAccountId = typeof toAccountIdRaw === "string" && toAccountIdRaw ? toAccountIdRaw : undefined;
      await createTransactionForCurrentUser({ type: "TRANSFER", amount, baseAmount, currency, transactionAt, fromAccountId, toAccountId, categoryId, memo });
      return { status: "success" };
    }

    const accountId = String(formData.get("accountId"));
    const isInstallment = type === "EXPENSE" && formData.get("installment") === "on";

    if (isInstallment) {
      const installmentCount = Number(String(formData.get("installmentCount") ?? ""));
      const firstPaymentDateRaw = String(formData.get("installmentFirstPaymentDate") ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(firstPaymentDateRaw)) throw new Error("첫 결제일을 입력해주세요");
      await createInstallmentPurchaseForCurrentUser({
        accountId,
        categoryId,
        transactionAt,
        amount,
        currency: "KRW",
        memo,
        installmentCount,
        interestType: "INTEREST_FREE",
        firstPaymentDate: firstPaymentDateRaw,
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

async function createCategory(name: string, kind: "INCOME" | "EXPENSE" | "BOTH") {
  "use server";
  const category = await createCategoryForCurrentUser(name, kind);
  return { id: category.id, name: category.name, kind: category.kind };
}

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.date;
  const requested = Array.isArray(raw) ? raw[0] : raw;
  const defaultDate = parseDefaultTransactionDate(requested);

  const [accounts, categories, tags, recentTransactions, creditCardSettings] = await Promise.all([
    listAccountsForCurrentUser(),
    listCategoriesForCurrentUser(),
    listTagsForCurrentUser(),
    listRecentTransactionsForPatterns(),
    listCreditCardSettingsForCurrentUser(),
  ]);
  const cardSettingsByAccountId = new Map(creditCardSettings.map((settings) => [settings.accountId, settings]));

  return (
    <div>
      <PageHeader title="거래 입력" />
      <QuickEntryForm
        accounts={accounts.map((account) => ({
          id: account.id,
          name: account.name,
          type: account.type,
          paymentDay: cardSettingsByAccountId.get(account.id)?.paymentDay,
          firstPaymentDate: cardSettingsByAccountId.get(account.id)?.firstPaymentDate,
        }))}
        categories={categories.map((category) => ({ id: category.id, name: category.name, kind: category.kind }))}
        tags={tags.map((tag) => ({ id: tag.id, name: tag.name }))}
        recentTransactions={recentTransactions.map((transaction) => ({
          accountId: transaction.accountId,
          categoryId: transaction.categoryId,
          type: transaction.type,
          occurredAt: transaction.transactionAt,
        }))}
        action={submitQuickEntry}
        onCreateCategory={createCategory}
        defaultDate={defaultDate}
      />
    </div>
  );
}
