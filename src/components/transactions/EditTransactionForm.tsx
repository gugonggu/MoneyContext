"use client";

import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";

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
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={transaction.id} />
      <input type="hidden" name="type" value={transaction.type} />

      <Card className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">금액</span>
          <input
            name="amount"
            inputMode="numeric"
            pattern="\d*"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-3xl font-bold tracking-tight text-slate-900 outline-none transition-colors focus:border-brand-600 disabled:bg-slate-100 disabled:text-slate-400"
          />
        </label>

        {transaction.type === "TRANSFER" ? (
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

        <TextField label="메모" name="memo" type="text" value={memo} onChange={(event) => setMemo(event.target.value)} />

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
      </Card>

      {state.status === "error" ? (
        <Alert kind="error" role="alert">
          {state.message}
        </Alert>
      ) : null}

      <Button type="submit" disabled={isPending} className="w-full">
        저장
      </Button>
    </form>
  );
}
