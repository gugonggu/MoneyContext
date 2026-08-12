import { revalidatePath } from "next/cache";

import { RecurringRuleForm, type RecurringRuleFormState } from "@/components/transactions/RecurringRuleForm";
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
    <div>
      <h1>반복 거래</h1>

      <section aria-labelledby="recurring-rules-heading">
        <h2 id="recurring-rules-heading">등록된 반복 거래</h2>
        {rules.length === 0 ? (
          <p>등록된 반복 거래가 없습니다.</p>
        ) : (
          <ul>
            {rules.map((rule) => (
              <li key={rule.id}>
                <span>
                  {rule.type === "INCOME" ? "수입" : "지출"} {rule.amount.toLocaleString("ko-KR")}원 · {accountNameById.get(rule.accountId) ?? "-"}
                  {rule.categoryId ? ` · ${categoryNameById.get(rule.categoryId) ?? "-"}` : ""} · {FREQUENCY_LABELS[rule.frequency]} · {CONFIRMATION_LABELS[rule.confirmationMode]}
                  {rule.isActive ? "" : " (비활성)"}
                </span>
                {rule.isActive ? (
                  <form action={deactivateRule}>
                    <input type="hidden" name="id" value={rule.id} />
                    <button type="submit">비활성화</button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <RecurringRuleForm accounts={accounts} categories={categories} action={createRule} />
    </div>
  );
}
