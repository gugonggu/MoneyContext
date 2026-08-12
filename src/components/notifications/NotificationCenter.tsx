"use client";

import { useTransition } from "react";

import type { NotificationType } from "@/domain/notifications/rules";
import type { NotificationRecord } from "@/server/notifications/service";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { cx } from "@/components/ui/cx";

export type MarkNotificationReadAction = (id: string) => Promise<void>;

const TYPE_BADGES: Record<NotificationType, { label: string; className: string }> = {
  BUDGET_THRESHOLD: { label: "예산 임계치", className: "bg-negative-50 text-negative-700" },
  RECURRING_CONFIRMATION: { label: "반복 거래 확인", className: "bg-brand-50 text-brand-700" },
  PLANNED_DUE: { label: "예정 거래", className: "bg-brand-50 text-brand-700" },
  CARD_PAYMENT_DUE: { label: "카드 결제일", className: "bg-slate-100 text-slate-700" },
  SAVINGS_RISK: { label: "저축 위험", className: "bg-negative-50 text-negative-700" },
};

function formatSeoulTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function NotificationRow({ notification, onMarkRead }: Readonly<{ notification: NotificationRecord; onMarkRead: MarkNotificationReadAction }>) {
  const [isPending, startTransition] = useTransition();
  const badge = TYPE_BADGES[notification.type];

  return (
    <Card
      className={cx(
        "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
        !notification.isRead && "border-brand-100 bg-brand-50/60",
      )}
    >
      <article className="flex min-w-0 flex-1 items-start gap-3">
        <span
          aria-hidden="true"
          className={cx(
            "mt-1.5 h-2 w-2 shrink-0 rounded-full",
            notification.isRead ? "bg-slate-300" : "bg-brand-500",
          )}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">{notification.title}</h2>
            {badge ? (
              <span className={cx("rounded-full px-2 py-0.5 text-xs font-medium", badge.className)}>{badge.label}</span>
            ) : null}
          </div>
          <p className="text-sm text-slate-600">{notification.message}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <time dateTime={notification.createdAt}>{formatSeoulTimestamp(notification.createdAt)}</time>
            <span aria-hidden="true">·</span>
            <span className={notification.isRead ? "text-slate-400" : "font-medium text-brand-600"}>
              {notification.isRead ? "읽음" : "읽지 않음"}
            </span>
          </div>
        </div>
      </article>
      {!notification.isRead ? (
        <Button
          type="button"
          variant="secondary"
          className="shrink-0 self-start sm:self-center"
          onClick={() => startTransition(async () => onMarkRead(notification.id))}
          disabled={isPending}
        >
          읽음 처리
        </Button>
      ) : null}
    </Card>
  );
}

export function NotificationCenter({ notifications, onMarkRead }: Readonly<{ notifications: readonly NotificationRecord[]; onMarkRead: MarkNotificationReadAction }>) {
  return (
    <section aria-labelledby="notification-heading">
      <div id="notification-heading">
        <PageHeader title="알림" />
      </div>
      {notifications.length === 0 ? (
        <Card className="text-sm text-slate-500">새 알림이 없습니다.</Card>
      ) : (
        <div className="flex flex-col gap-3">
          {notifications.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} onMarkRead={onMarkRead} />
          ))}
        </div>
      )}
    </section>
  );
}
