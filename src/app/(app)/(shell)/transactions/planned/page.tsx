import { revalidatePath } from "next/cache";

import { PlannedTransactionForm, type PlannedTransactionFormState } from "@/components/transactions/PlannedTransactionForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { listAccountsForCurrentUser } from "@/server/accounts";
import { listCategoriesForCurrentUser } from "@/server/categories";
import { confirmPlannedTransactionForCurrentUser, createPlannedTransactionForCurrentUser, listPlannedTransactionsForCurrentUser, removePlannedTransactionForCurrentUser } from "@/server/planned";

const STATUS_LABELS = { PLANNED: "예정", CONFIRMED: "확정됨", CANCELLED: "취소됨" } as const;

async function createPlanned(_: PlannedTransactionFormState, formData: FormData): Promise<PlannedTransactionFormState> {
  "use server";
  try {
    const type = String(formData.get("type"));
    if (type !== "INCOME" && type !== "EXPENSE") throw new Error("유형을 선택하세요");
    const amountRaw = String(formData.get("amount") ?? "");
    if (!/^\d+$/.test(amountRaw)) throw new Error("금액을 올바르게 입력해주세요");
    const accountId = String(formData.get("accountId") ?? "");
    if (!accountId) throw new Error("결제수단을 선택하세요");
    const categoryId = String(formData.get("categoryId") ?? "") || undefined;
    const memo = String(formData.get("memo") ?? "").trim() || undefined;

    await createPlannedTransactionForCurrentUser({
      type,
      scheduledDate: String(formData.get("scheduledDate")),
      amount: Number(amountRaw),
      currency: "KRW",
      accountId,
      categoryId,
      memo,
    });

    revalidatePath("/transactions/planned");
    return { status: "success" };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "저장에 실패했습니다." };
  }
}

async function confirmPlanned(formData: FormData): Promise<void> {
  "use server";
  await confirmPlannedTransactionForCurrentUser(String(formData.get("id")));
  revalidatePath("/transactions/planned");
}

async function removePlanned(formData: FormData): Promise<void> {
  "use server";
  await removePlannedTransactionForCurrentUser(String(formData.get("id")));
  revalidatePath("/transactions/planned");
}

export default async function PlannedTransactionsPage() {
  const [planned, accounts, categories] = await Promise.all([
    listPlannedTransactionsForCurrentUser(),
    listAccountsForCurrentUser(),
    listCategoriesForCurrentUser(),
  ]);

  const accountNameById = new Map(accounts.map((account) => [account.id, account.name]));
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="예정 거래" />

      <section aria-labelledby="planned-transactions-heading" className="flex flex-col gap-3">
        <h2 id="planned-transactions-heading" className="text-base font-semibold text-content-primary">
          등록된 예정 거래
        </h2>
        {planned.length === 0 ? (
          <p className="text-sm text-content-muted">등록된 예정 거래가 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {planned.map((item) => (
              <li key={item.id}>
                <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-content-secondary">
                    {item.scheduledDate} ·{" "}
                    <span className={item.type === "INCOME" ? "font-semibold text-positive-700" : "font-semibold text-content-primary"}>
                      {item.type === "INCOME" ? "수입" : "지출"} {item.amount.toLocaleString("ko-KR")}원
                    </span>
                    {item.accountId ? ` · ${accountNameById.get(item.accountId) ?? "-"}` : ""}
                    {item.categoryId ? ` · ${categoryNameById.get(item.categoryId) ?? "-"}` : ""} · {STATUS_LABELS[item.status]}
                  </span>
                  {item.status === "PLANNED" ? (
                    <div className="flex gap-2">
                      <form action={confirmPlanned}>
                        <input type="hidden" name="id" value={item.id} />
                        <Button type="submit" variant="secondary">
                          지금 확정
                        </Button>
                      </form>
                      <form action={removePlanned}>
                        <input type="hidden" name="id" value={item.id} />
                        <Button type="submit" variant="ghost">
                          삭제
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PlannedTransactionForm accounts={accounts} categories={categories} action={createPlanned} />
    </div>
  );
}
