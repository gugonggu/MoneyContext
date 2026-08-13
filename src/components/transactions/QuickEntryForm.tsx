"use client";

import { useActionState, useMemo, useState } from "react";

import {
  rankFrequentCategories,
  rankFrequentCategoryAccountCombos,
  rankRecentAccounts,
} from "@/domain/transactions/pattern-recommendations";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { ToggleButton } from "@/components/ui/ToggleButton";

export type QuickEntryAccount = Readonly<{
  id: string;
  name: string;
  type: "BANK" | "CASH" | "DEBIT" | "CREDIT_CARD" | "LIABILITY";
}>;

export type QuickEntryCategory = Readonly<{ id: string; name: string; kind: "INCOME" | "EXPENSE" | "BOTH" }>;
export type QuickEntryTag = Readonly<{ id: string; name: string }>;
export type QuickEntryRecentTransaction = Readonly<{
  accountId: string;
  categoryId?: string;
  type: "INCOME" | "EXPENSE";
  occurredAt: string;
}>;

export type QuickEntryState = Readonly<{ status: "idle" | "success" | "error"; message?: string }>;
export type QuickEntryAction = (state: QuickEntryState, formData: FormData) => Promise<QuickEntryState>;

type TransactionTypeOption = "EXPENSE" | "INCOME" | "TRANSFER";

const TYPE_LABELS: Record<TransactionTypeOption, string> = {
  EXPENSE: "지출",
  INCOME: "수입",
  TRANSFER: "이체",
};

const CURRENCIES = ["KRW", "USD", "JPY", "EUR"];

export function QuickEntryForm({
  accounts,
  categories,
  tags,
  action,
  recentTransactions = [],
  today = new Date().toISOString().slice(0, 10),
  defaultDate,
}: Readonly<{
  accounts: readonly QuickEntryAccount[];
  categories: readonly QuickEntryCategory[];
  tags: readonly QuickEntryTag[];
  action: QuickEntryAction;
  recentTransactions?: readonly QuickEntryRecentTransaction[];
  today?: string;
  defaultDate?: string;
}>) {
  const [state, formAction, isPending] = useActionState(action, { status: "idle" });

  const [type, setType] = useState<TransactionTypeOption>("EXPENSE");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [fromAccountId, setFromAccountId] = useState(accounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id ?? accounts[0]?.id ?? "");

  const [showDetails, setShowDetails] = useState(Boolean(defaultDate));
  const [transactionAt, setTransactionAt] = useState(defaultDate ? `${defaultDate}T12:00` : "");
  const [memo, setMemo] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<ReadonlySet<string>>(new Set());
  const [currency, setCurrency] = useState("KRW");
  const [exchangeRate, setExchangeRate] = useState("");
  const [installment, setInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState("3");

  const visibleCategories = categories.filter((category) => category.kind === "BOTH" || category.kind === type);
  const hasCreditCardAccount = accounts.some((account) => account.type === "CREDIT_CARD");

  const accountNameById = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]);
  const categoryNameById = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);

  const patternTransactions = useMemo(
    () =>
      recentTransactions
        .filter((transaction) => transaction.type === type)
        .map((transaction) => ({ accountId: transaction.accountId, categoryId: transaction.categoryId, occurredAt: transaction.occurredAt })),
    [recentTransactions, type],
  );

  const recentAccountSuggestions = useMemo(
    () =>
      type === "TRANSFER"
        ? []
        : rankRecentAccounts(patternTransactions, today)
            .map((ranked) => ({ id: ranked.key, name: accountNameById.get(ranked.key) }))
            .filter((item): item is { id: string; name: string } => Boolean(item.name)),
    [patternTransactions, today, type, accountNameById],
  );

  const frequentCategorySuggestions = useMemo(
    () =>
      type === "TRANSFER"
        ? []
        : rankFrequentCategories(patternTransactions, today)
            .map((ranked) => ({ id: ranked.key, name: categoryNameById.get(ranked.key) }))
            .filter((item): item is { id: string; name: string } => Boolean(item.name)),
    [patternTransactions, today, type, categoryNameById],
  );

  const comboSuggestions = useMemo(
    () =>
      type === "TRANSFER"
        ? []
        : rankFrequentCategoryAccountCombos(patternTransactions, today)
            .map((ranked) => {
              const [categoryKey, accountKey] = ranked.key.split(":");
              const categoryName = categoryNameById.get(categoryKey);
              const accountName = accountNameById.get(accountKey);
              return categoryName && accountName ? { categoryId: categoryKey, accountId: accountKey, categoryName, accountName } : null;
            })
            .filter((item): item is { categoryId: string; accountId: string; categoryName: string; accountName: string } => item !== null),
    [patternTransactions, today, type, categoryNameById, accountNameById],
  );

  const hasSuggestions = recentAccountSuggestions.length > 0 || frequentCategorySuggestions.length > 0 || comboSuggestions.length > 0;

  function toggleTag(tagId: string) {
    setSelectedTagIds((current) => {
      const next = new Set(current);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="type" value={type} />

      <Card className="flex flex-col gap-5">
        <div role="radiogroup" aria-label="거래 유형" className="flex gap-1.5 rounded-full bg-surface-base p-1">
          {(Object.keys(TYPE_LABELS) as TransactionTypeOption[]).map((value) => (
            <ToggleButton
              key={value}
              type="button"
              role="radio"
              aria-checked={type === value}
              onClick={() => setType(value)}
              className="flex-1 text-center"
            >
              {TYPE_LABELS[value]}
            </ToggleButton>
          ))}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-content-secondary">금액</span>
          <input
            name="amount"
            inputMode="numeric"
            pattern="\d*"
            required
            autoFocus
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0"
            className="rounded-tile border border-border-strong bg-surface-raised px-4 py-3 text-3xl font-bold tracking-tight text-content-primary outline-none transition-colors placeholder:text-content-muted focus:border-brand-600 disabled:bg-surface-base disabled:text-content-muted"
          />
        </label>

        {hasSuggestions ? (
          <div className="flex flex-col gap-3">
            {recentAccountSuggestions.length > 0 ? (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-content-muted">최근 사용 결제수단</p>
                <div className="flex flex-wrap gap-1.5">
                  {recentAccountSuggestions.map((suggestion) => (
                    <ToggleButton key={suggestion.id} type="button" onClick={() => setAccountId(suggestion.id)}>
                      {suggestion.name}
                    </ToggleButton>
                  ))}
                </div>
              </div>
            ) : null}

            {frequentCategorySuggestions.length > 0 ? (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-content-muted">자주 쓰는 카테고리</p>
                <div className="flex flex-wrap gap-1.5">
                  {frequentCategorySuggestions.map((suggestion) => (
                    <ToggleButton key={suggestion.id} type="button" onClick={() => setCategoryId(suggestion.id)}>
                      {suggestion.name}
                    </ToggleButton>
                  ))}
                </div>
              </div>
            ) : null}

            {comboSuggestions.length > 0 ? (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-content-muted">자주 쓰는 카테고리 + 결제수단 조합</p>
                <div className="flex flex-wrap gap-1.5">
                  {comboSuggestions.map((suggestion) => (
                    <ToggleButton
                      key={`${suggestion.categoryId}:${suggestion.accountId}`}
                      type="button"
                      onClick={() => {
                        setCategoryId(suggestion.categoryId);
                        setAccountId(suggestion.accountId);
                      }}
                    >
                      {suggestion.categoryName} · {suggestion.accountName}
                    </ToggleButton>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {type === "TRANSFER" ? (
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <Select label="출금 계좌" name="fromAccountId" required value={fromAccountId} onChange={(event) => setFromAccountId(event.target.value)}>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex-1">
              <Select label="입금 계좌" name="toAccountId" required value={toAccountId} onChange={(event) => setToAccountId(event.target.value)}>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <Select label="카테고리" name="categoryId" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">선택 안 함</option>
                {visibleCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex-1">
              <Select label="결제수단" name="accountId" required value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <Button type="button" variant="ghost" onClick={() => setShowDetails((value) => !value)} aria-expanded={showDetails} className="self-start">
          상세 옵션 {showDetails ? "숨기기" : "펼치기"}
        </Button>

        {showDetails ? (
          <div className="flex flex-col gap-4 border-t border-border-subtle pt-4">
            <TextField
              label="날짜/시간"
              name="transactionAt"
              type="datetime-local"
              value={transactionAt}
              onChange={(event) => setTransactionAt(event.target.value)}
            />

            <TextField label="메모" name="memo" type="text" value={memo} onChange={(event) => setMemo(event.target.value)} />

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-content-secondary">태그</legend>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <ToggleButton key={tag.id} type="button" role="checkbox" aria-checked={selectedTagIds.has(tag.id)} onClick={() => toggleTag(tag.id)}>
                    {tag.name}
                  </ToggleButton>
                ))}
              </div>
              {Array.from(selectedTagIds).map((tagId) => (
                <input key={tagId} type="hidden" name="tagIds" value={tagId} />
              ))}
            </fieldset>

            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1">
                <Select label="통화" name="currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>
                  {CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </Select>
              </div>

              {currency !== "KRW" ? (
                <div className="flex-1">
                  <TextField
                    label="환율"
                    name="exchangeRate"
                    inputMode="decimal"
                    required
                    value={exchangeRate}
                    onChange={(event) => setExchangeRate(event.target.value)}
                  />
                </div>
              ) : null}
            </div>

            {type === "EXPENSE" && hasCreditCardAccount ? (
              <div className="flex flex-col gap-3">
                <ToggleButton type="button" role="checkbox" aria-checked={installment} onClick={() => setInstallment((value) => !value)} className="self-start">
                  할부로 결제
                </ToggleButton>
                {installment ? <input type="hidden" name="installment" value="on" /> : null}
                {installment ? (
                  <TextField
                    label="할부 개월"
                    name="installmentCount"
                    inputMode="numeric"
                    pattern="\d*"
                    value={installmentCount}
                    onChange={(event) => setInstallmentCount(event.target.value)}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      {state.status === "error" ? (
        <Alert kind="error" role="alert">
          {state.message}
        </Alert>
      ) : null}
      {state.status === "success" ? (
        <Alert kind="success" role="status">
          저장했습니다.
        </Alert>
      ) : null}

      <Button type="submit" disabled={isPending} className="w-full">
        저장
      </Button>
    </form>
  );
}
