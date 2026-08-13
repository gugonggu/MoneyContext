"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Ring } from "@/components/ui/Ring";
import { creditUsageRatio } from "@/domain/cards/outstanding";
import { EditCreditCardForm, type EditCreditCardAction, type EditableCreditCard } from "./EditCreditCardForm";

const format = (amount: number) => amount.toLocaleString("ko-KR");

export type CreditCardRowCard = EditableCreditCard & {
  outstanding: number;
  availableLimit: number | null;
  nextPaymentDate: string | null;
  installmentSchedule: readonly Readonly<{ id: string; scheduledDate: string; paymentAmount: number }>[];
};

export function CreditCardRow({
  card,
  bankAccounts,
  editAction,
}: Readonly<{
  card: CreditCardRowCard;
  bankAccounts: readonly Readonly<{ id: string; name: string }>[];
  editAction: EditCreditCardAction;
}>) {
  const [isEditing, setIsEditing] = useState(false);
  const ratio = creditUsageRatio(card.outstanding, card.availableLimit);

  return (
    <Card className="border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-white/80">{card.name}</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={isEditing}
              onClick={() => setIsEditing((value) => !value)}
              className="px-2 py-0.5 text-xs text-white/70 hover:bg-white/10"
            >
              {isEditing ? "닫기" : "수정"}
            </Button>
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight text-white sm:text-3xl">미결제액 {format(card.outstanding)}원</p>
          </div>
          <p className="text-sm text-white/60">다음 결제일 {card.nextPaymentDate ?? "-"}</p>
          {card.installmentSchedule.length ? (
            <ul className="flex flex-col gap-1 border-t border-white/20 pt-2 text-sm text-white/80">
              {card.installmentSchedule.map((payment) => (
                <li key={payment.id}>
                  {payment.scheduledDate} · {format(payment.paymentAmount)}원
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {ratio === null ? null : <Ring ratio={ratio} label="한도 사용률" caption={`남은 한도 ${format(card.availableLimit ?? 0)}원`} />}
      </div>

      {isEditing ? <EditCreditCardForm card={card} bankAccounts={bankAccounts} action={editAction} /> : null}
    </Card>
  );
}
