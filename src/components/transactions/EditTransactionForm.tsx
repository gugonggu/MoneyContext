"use client";

import { useActionState, useState } from "react";

export type EditAccount = Readonly<{ id: string; name: string; type: string }>;
export type EditCategory = Readonly<{ id: string; name: string; kind: "INCOME" | "EXPENSE" | "BOTH" }>;

export type EditTransaction = Readonly<{
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT";
  amount: number;
  currency: string;
  exchangeRate?: string;
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  categoryId?: string;
  memo?: string;
}>;

export type EditTransactionState = Readonly<{ status: "idle" | "error"; message?: string }>;
export type EditTransactionAction = (state: EditTransactionState, formData: FormData) => Promise<EditTransactionState>;

const CURRENCIES = ["KRW", "USD", "JPY", "EUR"];

export function EditTransactionForm({
  transaction,
  accounts,
  categories,
  action,
}: Readonly<{
  transaction: EditTransaction;
  accounts: readonly EditAccount[];
  categories: readonly EditCategory[];
  action: EditTransactionAction;
}>) {
  const [state, formAction, isPending] = useActionState(action, { status: "idle" });

  const [amount, setAmount] = useState(String(transaction.amount));
  const [memo, setMemo] = useState(transaction.memo ?? "");
  const [categoryId, setCategoryId] = useState(transaction.categoryId ?? "");
  const [accountId, setAccountId] = useState(transaction.accountId ?? accounts[0]?.id ?? "");
  const [fromAccountId, setFromAccountId] = useState(transaction.fromAccountId ?? accounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(transaction.toAccountId ?? accounts[1]?.id ?? accounts[0]?.id ?? "");
  const [currency, setCurrency] = useState(transaction.currency);
  const [exchangeRate, setExchangeRate] = useState(transaction.exchangeRate ?? "");

  const visibleCategories = categories.filter((category) => category.kind === "BOTH" || category.kind === transaction.type);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={transaction.id} />
      <input type="hidden" name="type" value={transaction.type} />

      <label>
        금액
        <input
          name="amount"
          inputMode="numeric"
          pattern="\d*"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>

      {transaction.type === "TRANSFER" ? (
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

      <label>
        메모
        <input name="memo" type="text" value={memo} onChange={(event) => setMemo(event.target.value)} />
      </label>

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

      {state.status === "error" ? <p role="alert">{state.message}</p> : null}

      <button type="submit" disabled={isPending}>
        저장
      </button>
    </form>
  );
}
