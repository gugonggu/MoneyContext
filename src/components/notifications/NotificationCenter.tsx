"use client";

import { useTransition } from "react";

import type { NotificationRecord } from "@/server/notifications/service";

export type MarkNotificationReadAction = (id: string) => Promise<void>;

function formatSeoulTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function NotificationRow({ notification, onMarkRead }: Readonly<{ notification: NotificationRecord; onMarkRead: MarkNotificationReadAction }>) {
  const [isPending, startTransition] = useTransition();

  return (
    <article>
      <h2>{notification.title}</h2>
      <p>{notification.message}</p>
      <p>
        <time dateTime={notification.createdAt}>{formatSeoulTimestamp(notification.createdAt)}</time>
      </p>
      <p>{notification.isRead ? "읽음" : "읽지 않음"}</p>
      {!notification.isRead ? (
        <button type="button" onClick={() => startTransition(async () => onMarkRead(notification.id))} disabled={isPending}>
          읽음 처리
        </button>
      ) : null}
    </article>
  );
}

export function NotificationCenter({ notifications, onMarkRead }: Readonly<{ notifications: readonly NotificationRecord[]; onMarkRead: MarkNotificationReadAction }>) {
  return (
    <section aria-labelledby="notification-heading">
      <h1 id="notification-heading">알림</h1>
      {notifications.length === 0 ? <p>새 알림이 없습니다.</p> : notifications.map((notification) => (
        <NotificationRow key={notification.id} notification={notification} onMarkRead={onMarkRead} />
      ))}
    </section>
  );
}
