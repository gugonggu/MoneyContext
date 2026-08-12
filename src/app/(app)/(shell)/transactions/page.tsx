import Link from "next/link";
import { redirect } from "next/navigation";

import { DeleteTransactionButton } from "@/components/transactions/DeleteTransactionButton";
import styles from "@/components/transactions/TransactionHistory.module.css";
import { groupTransactionsByDate } from "@/domain/transactions/group-by-date";
import { listAccountsForCurrentUser } from "@/server/accounts";
import { listCategoriesForCurrentUser, listTagsForCurrentUser } from "@/server/categories";
import { removeTransactionForCurrentUser, searchTransactionsForCurrentUser, type TransactionSearchResult } from "@/server/transactions";

const TYPE_LABELS = { INCOME: "수입", EXPENSE: "지출", TRANSFER: "이체", ADJUSTMENT: "조정" } as const;
const STATUS_LABELS = { PENDING: "대기", CONFIRMED: "확정", CANCELLED: "취소" } as const;
const PAGE_SIZE = 20;

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
    <div>
      <h1>거래내역</h1>
      <nav aria-label="거래 관리">
        <Link href="/transactions/new">거래 입력</Link>
        <Link href="/transactions/recurring">반복 거래</Link>
        <Link href="/transactions/planned">예정 거래</Link>
      </nav>

      <form>
        <label>
          기간(시작)
          <input type="date" name="from" defaultValue={filters.from ?? ""} />
        </label>
        <label>
          기간(끝)
          <input type="date" name="to" defaultValue={filters.to ?? ""} />
        </label>
        <label>
          유형
          <select name="type" defaultValue={filters.type ?? ""}>
            <option value="">전체</option>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          계좌/카드
          <select name="accountId" defaultValue={filters.accountId ?? ""}>
            <option value="">전체</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          카테고리
          <select name="categoryId" defaultValue={filters.categoryId ?? ""}>
            <option value="">전체</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          태그
          <select name="tagId" defaultValue={filters.tagId ?? ""}>
            <option value="">전체</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          상태
          <select name="status" defaultValue={filters.status ?? ""}>
            <option value="">전체</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          최소 금액
          <input name="minAmount" inputMode="numeric" defaultValue={filters.minAmount ?? ""} />
        </label>
        <label>
          최대 금액
          <input name="maxAmount" inputMode="numeric" defaultValue={filters.maxAmount ?? ""} />
        </label>
        <label>
          메모 검색
          <input name="memo" defaultValue={filters.memo ?? ""} />
        </label>
        <button type="submit">검색</button>
        <Link href="/transactions">초기화</Link>
      </form>

      {transactions.length === 0 ? (
        <p>조건에 맞는 거래가 없습니다.</p>
      ) : (
        <>
          <div className={styles.mobileView} data-testid="mobile-history">
            {groups.map((group) => (
              <section key={group.date}>
                <h2>{group.date}</h2>
                <ul>
                  {group.transactions.map((row) => (
                    <li key={row.id}>
                      <div>
                        <span>{contentLabel(row)}</span>{" "}
                        <span>
                          {row.type === "INCOME" ? "+" : row.type === "EXPENSE" ? "-" : ""}
                          {row.amount.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        {categoryNameById.get(row.categoryId ?? "") ?? ""} · {accountLabel(row)}
                      </div>
                      {row.tagNames.length > 0 ? <div>{row.tagNames.join(", ")}</div> : null}
                      <Link href={`/transactions/${row.id}/edit`}>수정</Link>
                      <DeleteTransactionButton id={row.id} query={queryString} action={deleteTransaction} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <table className={styles.desktopView} data-testid="desktop-history">
            <thead>
              <tr>
                <th>날짜</th>
                <th>유형</th>
                <th>내용</th>
                <th>카테고리</th>
                <th>결제수단</th>
                <th>태그</th>
                <th>원통화</th>
                <th>KRW</th>
                <th>상태</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((row) => (
                <tr key={row.id}>
                  <td>{row.transactionAt.slice(0, 10)}</td>
                  <td>{TYPE_LABELS[row.type]}</td>
                  <td>{contentLabel(row)}</td>
                  <td>{categoryNameById.get(row.categoryId ?? "") ?? ""}</td>
                  <td>{accountLabel(row)}</td>
                  <td>{row.tagNames.join(", ")}</td>
                  <td>
                    {row.currency} {row.amount.toLocaleString()}
                  </td>
                  <td>{row.baseAmount.toLocaleString()}</td>
                  <td>{STATUS_LABELS[row.status]}</td>
                  <td>
                    <Link href={`/transactions/${row.id}/edit`}>수정</Link>
                    <DeleteTransactionButton id={row.id} query={queryString} action={deleteTransaction} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <nav aria-label="페이지">
            {page > 1 ? <Link href={hrefForPage(page - 1)}>이전</Link> : null}
            <span>{page}페이지</span>
            {hasMore ? <Link href={hrefForPage(page + 1)}>다음</Link> : null}
          </nav>
        </>
      )}
    </div>
  );
}
