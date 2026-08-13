import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

import { RecurringRuleForm, type RecurringRuleFormState } from "@/components/transactions/RecurringRuleForm";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { todayInSeoul } from "@/lib/dates/seoul";
import { listAccountsForCurrentUser } from "@/server/accounts";
import { listCategoriesForCurrentUser } from "@/server/categories";
import {
  createRecurringRuleForCurrentUser,
  deactivateRecurringRuleForCurrentUser,
  generateDueRecurringTransactionsForCurrentUser,
  listRecurringRulesForCurrentUser,
} from "@/server/recurring";

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

async function generateDueNow(): Promise<void> {
  "use server";
  // Occurrences otherwise only materialize once a day via the cron job at
  // /api/cron/recurring - this lets the current user pull due rules into real
  // transactions right now instead of waiting for that to run.
  const generated = await generateDueRecurringTransactionsForCurrentUser(todayInSeoul());
  const confirmed = generated.filter((item) => item.status === "CONFIRMED").length;
  const pending = generated.filter((item) => item.status === "PENDING").length;
  revalidatePath("/transactions/recurring");
  redirect(`/transactions/recurring?generated=${generated.length}&confirmed=${confirmed}&pending=${pending}`);
}

export default async function RecurringTransactionsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ generated?: string; confirmed?: string; pending?: string }> }>) {
  const { generated, confirmed, pending } = await searchParams;
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

      {generated !== undefined ? (
        <Alert kind={Number(generated) > 0 ? "success" : "info"} role="status">
          {Number(generated) > 0 ? (
            <>
              {generated}건 생성됨 (확정 {confirmed ?? 0}건, 확인 대기 {pending ?? 0}건).{" "}
              {Number(pending) > 0 ? (
                <Link href="/transactions" className="font-semibold underline">
                  거래내역에서 확정하기
                </Link>
              ) : null}
            </>
          ) : (
            "오늘 기준으로 새로 생성할 반복 거래가 없어요. 아직 발생 예정일이 안 됐거나, 이번 회차는 이미 생성됐어요."
          )}
        </Alert>
      ) : null}

      <section aria-labelledby="recurring-rules-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="recurring-rules-heading" className="text-base font-semibold text-content-primary">
            등록된 반복 거래
          </h2>
          <form action={generateDueNow}>
            <Button type="submit" variant="secondary" size="sm">
              오늘 기준으로 지금 생성
            </Button>
          </form>
        </div>
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
