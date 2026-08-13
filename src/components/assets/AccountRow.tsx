"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EditAccountForm, type EditAccountAction, type EditableAccount } from "./EditAccountForm";
import { ReconciliationForm, type ReconciliationAction } from "./ReconciliationForm";

const format = (amount: number) => amount.toLocaleString("ko-KR");

export function AccountRow({
  account,
  bankAccounts,
  reconcileAction,
  editAction,
}: Readonly<{
  account: EditableAccount;
  bankAccounts: readonly Readonly<{ id: string; name: string }>[];
  reconcileAction: ReconciliationAction;
  editAction: EditAccountAction;
}>) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <Card variant="glass" className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-3 sm:flex-1">
          <h3 className="text-sm font-medium text-content-primary">{account.name}</h3>
          <p className="text-lg font-bold tracking-tight text-content-primary">{format(account.balance)}원</p>
        </div>
        <div className="flex items-center gap-2">
          <ReconciliationForm accountId={account.id} accountName={account.name} action={reconcileAction} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={isEditing}
            onClick={() => setIsEditing((value) => !value)}
            className="px-2.5 py-1 text-xs"
          >
            {isEditing ? "닫기" : "수정"}
          </Button>
        </div>
      </div>

      {isEditing ? <EditAccountForm account={account} bankAccounts={bankAccounts} action={editAction} /> : null}
    </Card>
  );
}
