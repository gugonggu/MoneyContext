import Link from "next/link";
import { redirect } from "next/navigation";

import { DeleteTransactionButton } from "@/components/transactions/DeleteTransactionButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cx } from "@/components/ui/cx";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { groupTransactionsByDate } from "@/domain/transactions/group-by-date";
import { listAccountsForCurrentUser } from "@/server/accounts";
import { listCategoriesForCurrentUser, listTagsForCurrentUser } from "@/server/categories";
import { removeTransactionForCurrentUser, searchTransactionsForCurrentUser, type TransactionSearchResult } from "@/server/transactions";

const TYPE_LABELS = { INCOME: "수입", EXPENSE: "지출", TRANSFER: "이체", ADJUSTMENT: "조정" } as const;
const STATUS_LABELS = { PENDING: "대기", CONFIRMED: "확정", CANCELLED: "취소" } as const;
const PAGE_SIZE = 20;

const secondaryLinkClasses =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50";

function amountColor(type: TransactionSearchResult["type"]): string {
  if (type === "INCOME") return "text-positive-700";
  if (type === "EXPENSE") return "text-slate-900";
  return "text-slate-500";
}

type RawSearchParams = Record<string, string | string[] | undefined>;

function param(searchParams: RawSearchParams, key: string): string | undefined {
  const value = searchParams[key];
  const first = Array.isArray(value) ? value[0] : value;
  return first || undefined;
}

async function deleteTransaction(formData: FormData): Promise<void> {
  "use server";

  const id = String(formData.get("id"));
  const query = String(formData.get("query") ?? "");
  await removeTransactionForCurrentUser(id);
  redirect(`/transactions${query}`);
}

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = await searchParams;

  const minAmountRaw = param(params, "minAmount");
  const maxAmountRaw = param(params, "maxAmount");
  const pageRaw = param(params, "page");
  const page = pageRaw && /^\d+$/.test(pageRaw) && Number(pageRaw) > 0 ? Number(pageRaw) : 1;
  const filters = {
    from: param(params, "from"),
    to: param(params, "to"),
    type: param(params, "type") as TransactionSearchResult["type"] | undefined,
    accountId: param(params, "accountId"),
    categoryId: param(params, "categoryId"),
    tagId: param(params, "tagId"),
    status: param(params, "status") as TransactionSearchResult["status"] | undefined,
    minAmount: minAmountRaw ? Number(minAmountRaw) : undefined,
    maxAmount: maxAmountRaw ? Number(maxAmountRaw) : undefined,
    memo: param(params, "memo"),
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };

  const [accounts, categories, tags, searchPage] = await Promise.all([
    listAccountsForCurrentUser(),
    listCategoriesForCurrentUser(),
    listTagsForCurrentUser(),
    searchTransactionsForCurrentUser(filters),
  ]);
  const { items: transactions, hasMore } = searchPage;

  const accountNameById = new Map(accounts.map((account) => [account.id, account.name]));
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));

  function accountLabel(row: TransactionSearchResult): string {
    if (row.type === "TRANSFER") {
      return `${accountNameById.get(row.fromAccountId ?? "") ?? "-"} → ${accountNameById.get(row.toAccountId ?? "") ?? "-"}`;
    }
    return accountNameById.get(row.accountId ?? "") ?? "-";
  }

  function contentLabel(row: TransactionSearchResult): string {
    return row.memo || categoryNameById.get(row.categoryId ?? "") || TYPE_LABELS[row.type];
  }

  const groups = groupTransactionsByDate(transactions.map((row) => ({ ...row, transactionAt: row.transactionAt })));
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page") continue;
    const first = Array.isArray(value) ? value[0] : value;
    if (first) query.set(key, first);
  }
  const queryString = query.toString() ? `?${query.toString()}` : "";

  function hrefForPage(targetPage: number): string {
    const pageQuery = new URLSearchParams(query);
    if (targetPage > 1) pageQuery.set("page", String(targetPage));
    const suffix = pageQuery.toString();
    return `/transactions${suffix ? `?${suffix}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="거래내역"
        actions={
          <nav aria-label="거래 관리" className="flex flex-wrap gap-2">
            <Link href="/transactions/new" className={secondaryLinkClasses}>
              거래 입력
            </Link>
            <Link href="/transactions/recurring" className={secondaryLinkClasses}>
              반복 거래
            </Link>
            <Link href="/transactions/planned" className={secondaryLinkClasses}>
              예정 거래
            </Link>
          </nav>
        }
      />

      <Card>
        <form className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <TextField label="기간(시작)" type="date" name="from" defaultValue={filters.from ?? ""} />
            <TextField label="기간(끝)" type="date" name="to" defaultValue={filters.to ?? ""} />
            <Select label="유형" name="type" defaultValue={filters.type ?? ""}>
              <option value="">전체</option>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select label="계좌/카드" name="accountId" defaultValue={filters.accountId ?? ""}>
              <option value="">전체</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
            <Select label="카테고리" name="categoryId" defaultValue={filters.categoryId ?? ""}>
              <option value="">전체</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Select label="태그" name="tagId" defaultValue={filters.tagId ?? ""}>
              <option value="">전체</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </Select>
            <Select label="상태" name="status" defaultValue={filters.status ?? ""}>
              <option value="">전체</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <TextField label="최소 금액" name="minAmount" inputMode="numeric" defaultValue={filters.minAmount ?? ""} />
            <TextField label="최대 금액" name="maxAmount" inputMode="numeric" defaultValue={filters.maxAmount ?? ""} />
            <TextField label="메모 검색" name="memo" defaultValue={filters.memo ?? ""} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit">검색</Button>
            <Link href="/transactions" className={secondaryLinkClasses}>
              초기화
            </Link>
          </div>
        </form>
      </Card>

      {transactions.length === 0 ? (
        <p className="text-sm text-slate-500">조건에 맞는 거래가 없습니다.</p>
      ) : (
        <>
          <div className="flex flex-col gap-4 md:hidden" data-testid="mobile-history">
            {groups.map((group) => (
              <section key={group.date} className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-slate-500">{group.date}</h2>
                <ul className="flex flex-col gap-2">
                  {group.transactions.map((row) => (
                    <li key={row.id}>
                      <Card className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium text-slate-900">{contentLabel(row)}</span>
                          <span className={cx("shrink-0 text-base font-semibold", amountColor(row.type))}>
                            {row.type === "INCOME" ? "+" : row.type === "EXPENSE" ? "-" : ""}
                            {row.amount.toLocaleString()}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {categoryNameById.get(row.categoryId ?? "") ?? ""} · {accountLabel(row)}
                        </div>
                        {row.tagNames.length > 0 ? <div className="text-xs text-slate-400">{row.tagNames.join(", ")}</div> : null}
                        <div className="flex items-center gap-1 pt-1">
                          <Link href={`/transactions/${row.id}/edit`} className="text-sm font-medium text-brand-600 hover:text-brand-700">
                            수정
                          </Link>
                          <DeleteTransactionButton id={row.id} query={queryString} action={deleteTransaction} />
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block" data-testid="desktop-history">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">날짜</th>
                  <th className="px-4 py-3">유형</th>
                  <th className="px-4 py-3">내용</th>
                  <th className="px-4 py-3">카테고리</th>
                  <th className="px-4 py-3">결제수단</th>
                  <th className="px-4 py-3">태그</th>
                  <th className="px-4 py-3">원통화</th>
                  <th className="px-4 py-3">KRW</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500">{row.transactionAt.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-slate-700">{TYPE_LABELS[row.type]}</td>
                    <td className="px-4 py-3 text-slate-900">{contentLabel(row)}</td>
                    <td className="px-4 py-3 text-slate-500">{categoryNameById.get(row.categoryId ?? "") ?? ""}</td>
                    <td className="px-4 py-3 text-slate-500">{accountLabel(row)}</td>
                    <td className="px-4 py-3 text-slate-500">{row.tagNames.join(", ")}</td>
                    <td className={cx("px-4 py-3 font-medium", amountColor(row.type))}>
                      {row.currency} {row.amount.toLocaleString()}
                    </td>
                    <td className={cx("px-4 py-3 font-medium", amountColor(row.type))}>{row.baseAmount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-500">{STATUS_LABELS[row.status]}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/transactions/${row.id}/edit`} className="font-medium text-brand-600 hover:text-brand-700">
                          수정
                        </Link>
                        <DeleteTransactionButton id={row.id} query={queryString} action={deleteTransaction} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <nav aria-label="페이지" className="flex items-center justify-center gap-4 text-sm">
            {page > 1 ? (
              <Link href={hrefForPage(page - 1)} className="font-medium text-brand-600 hover:text-brand-700">
                이전
              </Link>
            ) : null}
            <span className="text-slate-500">{page}페이지</span>
            {hasMore ? (
              <Link href={hrefForPage(page + 1)} className="font-medium text-brand-600 hover:text-brand-700">
                다음
              </Link>
            ) : null}
          </nav>
        </>
      )}
    </div>
  );
}
