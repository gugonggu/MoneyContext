import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NotificationCenter } from "@/components/notifications/NotificationCenter";

afterEach(cleanup);

const unreadNotification = {
  id: "notification-a",
  userId: "user-a",
  type: "PLANNED_DUE" as const,
  title: "예정 거래 예정일",
  message: "오늘 예정된 거래를 확인해 주세요.",
  relatedEntityType: "planned_transaction",
  relatedEntityId: "planned-a",
  isRead: false,
  createdAt: "2026-08-11T23:00:00.000Z",
  readAt: null,
};

describe("NotificationCenter", () => {
  it("renders an unread notification and marks its own id as read", async () => {
    const markRead = vi.fn(async () => undefined);

    render(<NotificationCenter notifications={[unreadNotification]} onMarkRead={markRead} />);

    expect(screen.getByRole("heading", { name: "알림" })).toBeTruthy();
    expect(screen.getByText("예정 거래 예정일")).toBeTruthy();
    expect(screen.getByText("오늘 예정된 거래를 확인해 주세요.")).toBeTruthy();
    expect(screen.getByText(/2026/)).toBeTruthy();
    expect(screen.getByText("읽지 않음")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "읽음 처리" }));

    await waitFor(() => expect(markRead).toHaveBeenCalledWith("notification-a"));
  });

  it("shows a read notification without a mark-as-read action", () => {
    render(<NotificationCenter notifications={[{ ...unreadNotification, isRead: true, readAt: "2026-08-12T00:00:00.000Z" }]} onMarkRead={async () => undefined} />);

    expect(screen.getByText("읽음")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "읽음 처리" })).toBeNull();
  });

  it("renders an empty state when there are no notifications", () => {
    render(<NotificationCenter notifications={[]} onMarkRead={async () => undefined} />);

    expect(screen.getByText("새 알림이 없습니다.")).toBeTruthy();
  });
});
