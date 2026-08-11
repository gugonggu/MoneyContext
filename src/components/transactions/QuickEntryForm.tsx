"use client";

import { useActionState, useState } from "react";

export type QuickEntryAccount = Readonly<{
  id: string;
  name: string;
  type: "BANK" | "CASH" | "DEBIT" | "CREDIT_CARD" | "LIABILITY";
}>;

export type QuickEntryCategory = Readonly<{ id: string; name: string; kind: "INCOME" | "EXPENSE" | "BOTH" }>;
export type QuickEntryTag = Readonly<{ id: string; name: string }>;

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
}: Readonly<{
  accounts: readonly QuickEntryAccount[];
  categories: readonly QuickEntryCategory[];
  tags: readonly QuickEntryTag[];
  action: QuickEntryAction;
}>) {
  const [state, formAction, isPending] = useActionState(action, { status: "idle" });

  const [type, setType] = useState<TransactionTypeOption>("EXPENSE");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [fromAccountId, setFromAccountId] = useState(accounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id ?? accounts[0]?.id ?? "");

  const [showDetails, setShowDetails] = useState(false);
  const [transactionAt, setTransactionAt] = useState("");
  const [memo, setMemo] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<ReadonlySet<string>>(new Set());
  const [currency, setCurrency] = useState("KRW");
  const [exchangeRate, setExchangeRate] = useState("");
  const [installment, setInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState("3");

  const visibleCategories = categories.filter((category) => category.kind === "BOTH" || category.kind === type);
  const hasCreditCardAccount = accounts.some((account) => account.type === "CREDIT_CARD");

  function toggleTag(tagId: string) {
    setSelectedTagIds((current) => {
      const next = new Set(current);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="type" value={type} />

      <div role="radiogroup" aria-label="거래 유형">
        {(Object.keys(TYPE_LABELS) as TransactionTypeOption[]).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={type === value}
            onClick={() => setType(value)}
          >
            {TYPE_LABELS[value]}
          </button>
        ))}
      </div>

      <label>
        금액
        <input
          name="amount"
          inputMode="numeric"
          pattern="\d*"
          required
          autoFocus
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>

      {type === "TRANSFER" ? (
        <>
          <label>
            출금 계좌
            <select name="fromAccountId" required value={fromAccountId} onChange={(event) => setFromAccountId(event.target.value)}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            입금 계좌
            <select name="toAccountId" required value={toAccountId} onChange={(event) => setToAccountId(event.target.value)}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <>
          <label>
            카테고리
            <select name="categoryId" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">선택 안 함</option>
              {visibleCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            결제수단
            <select name="accountId" required value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      <button type="button" onClick={() => setShowDetails((value) => !value)} aria-expanded={showDetails}>
        상세 옵션 {showDetails ? "숨기기" : "펼치기"}
      </button>

      {showDetails ? (
        <div>
          <label>
            날짜/시간
            <input
              name="transactionAt"
              type="datetime-local"
              value={transactionAt}
              onChange={(event) => setTransactionAt(event.target.value)}
            />
          </label>

          <label>
            메모
            <input name="memo" type="text" value={memo} onChange={(event) => setMemo(event.target.value)} />
          </label>

          <fieldset>
            <legend>태그</legend>
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                role="checkbox"
                aria-checked={selectedTagIds.has(tag.id)}
                onClick={() => toggleTag(tag.id)}
              >
                {tag.name}
              </button>
            ))}
            {Array.from(selectedTagIds).map((tagId) => (
              <input key={tagId} type="hidden" name="tagIds" value={tagId} />
            ))}
          </fieldset>

          <label>
            통화
            <select name="currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>

          {currency !== "KRW" ? (
            <label>
              환율
              <input
                name="exchangeRate"
                inputMode="decimal"
                required
                value={exchangeRate}
                onChange={(event) => setExchangeRate(event.target.value)}
              />
            </label>
          ) : null}

          {type === "EXPENSE" && hasCreditCardAccount ? (
            <>
              <button
                type="button"
                role="checkbox"
                aria-checked={installment}
                onClick={() => setInstallment((value) => !value)}
              >
                할부로 결제
              </button>
              {installment ? <input type="hidden" name="installment" value="on" /> : null}
              {installment ? (
                <label>
                  할부 개월
                  <input
                    name="installmentCount"
                    inputMode="numeric"
                    pattern="\d*"
                    value={installmentCount}
                    onChange={(event) => setInstallmentCount(event.target.value)}
                  />
                </label>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {state.status === "error" ? <p role="alert">{state.message}</p> : null}
      {state.status === "success" ? <p role="status">저장했습니다.</p> : null}

      <button type="submit" disabled={isPending}>
        저장
      </button>
    </form>
  );
}
