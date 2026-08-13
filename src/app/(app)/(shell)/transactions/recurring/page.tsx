import { revalidatePath } from "next/cache";

import { RecurringRuleForm, type RecurringRuleFormState } from "@/components/transactions/RecurringRuleForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { listAccountsForCurrentUser } from "@/server/accounts";
import { listCategoriesForCurrentUser } from "@/server/categories";
import { createRecurringRuleForCurrentUser, deactivateRecurringRuleForCurrentUser, listRecurringRulesForCurrentUser } from "@/server/recurring";

const FREQUENCY_LABELS = { DAILY: "매일", WEEKLY: "매주", MONTHLY: "매월" } as const;
const CONFIRMATION_LABELS = { AUTO_CONFIRM: "자동 확정", REQUIRE_CONFIRMATION: "확인 후 확정" } as const;

async function createRule(_: RecurringRuleFormState, formData: FormData): Promise<RecurringRuleFormState> {
  "use server";
  try {
    const type = String(formData.get("type"));
    if (type !== "INCOME" && type !== "EXPENSE") throw new Error("유형을 선택하세요");
    const amountRaw = String(formData.get("amount") ?? "");
    if (!/^\d+$/.test(amountRaw)) throw new Error("금액을 올바르게 입력해주세요");
    const frequency = String(formData.get("frequency"));
    if (frequency !== "DAILY" && frequency !== "WEEKLY" && frequency !== "MONTHLY") throw new Error("반복 주기를 선택하세요");
    const confirmationMode = String(formData.get("confirmationMode"));
    if (confirmationMode !== "AUTO_CONFIRM" && confirmationMode !== "REQUIRE_CONFIRMATION") throw new Error("확정 방식을 선택하세요");
    const intervalCountRaw = String(formData.get("intervalCount") ?? "1");
    if (!/^\d+$/.test(intervalCountRaw)) throw new Error("반복 간격을 올바르게 입력해주세요");
    const dayOfMonthRaw = String(formData.get("dayOfMonth") ?? "");
    const memo = String(formData.get("memo") ?? "").trim() || undefined;
    const categoryId = String(formData.get("categoryId") ?? "") || undefined;
    const endDate = String(formData.get("endDate") ?? "") || undefined;

    await createRecurringRuleForCurrentUser({
      type,
      amount: Number(amountRaw),
      currency: "KRW",
      accountId: String(formData.get("accountId")),
      categoryId,
      memo,
      frequency,
      intervalCount: Number(intervalCountRaw),
      dayOfMonth: dayOfMonthRaw ? Number(dayOfMonthRaw) : undefined,
      startDate: String(formData.get("startDate")),
      endDate,
      confirmationMode,
    });

    revalidatePath("/transactions/recurring");
    return { status: "success" };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "저장에 실패했습니다." };
  }
}

async function deactivateRule(formData: FormData): Promise<void> {
  "use server";
  await deactivateRecurringRuleForCurrentUser(String(formData.get("id")));
  revalidatePath("/transactions/recurring");
}

export default async function RecurringTransactionsPage() {
  const [rules, accounts, categories] = await Promise.all([
    listRecurringRulesForCurrentUser(),
    listAccountsForCurrentUser(),
    listCategoriesForCurrentUser(),
  ]);

  const accountNameById = new Map(accounts.map((account) => [account.id, account.name]));
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="반복 거래" />

      <section aria-labelledby="recurring-rules-heading" className="flex flex-col gap-3">
        <h2 id="recurring-rules-heading" className="text-base font-semibold text-content-primary">
          등록된 반복 거래
        </h2>
        {rules.length === 0 ? (
          <p className="text-sm text-content-muted">등록된 반복 거래가 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rules.map((rule) => (
              <li key={rule.id}>
                <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-content-secondary">
                    <span className={rule.type === "INCOME" ? "font-semibold text-positive-700" : "font-semibold text-content-primary"}>
                      {rule.type === "INCOME" ? "수입" : "지출"} {rule.amount.toLocaleString("ko-KR")}원
                    </span>{" "}
                    · {accountNameById.get(rule.accountId) ?? "-"}
                    {rule.categoryId ? ` · ${categoryNameById.get(rule.categoryId) ?? "-"}` : ""} · {FREQUENCY_LABELS[rule.frequency]} ·{" "}
                    {CONFIRMATION_LABELS[rule.confirmationMode]}
                    {rule.isActive ? "" : " (비활성)"}
                  </span>
                  {rule.isActive ? (
                    <form action={deactivateRule}>
                      <input type="hidden" name="id" value={rule.id} />
                      <Button type="submit" variant="secondary">
                        비활성화
                      </Button>
                    </form>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <RecurringRuleForm accounts={accounts} categories={categories} action={createRule} />
    </div>
  );
}
