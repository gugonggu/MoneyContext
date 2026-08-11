import { describe, expect, it } from "vitest";

import type { NotificationRuleInput } from "@/domain/notifications/rules";
import {
  createNotificationService,
  type NotificationRecord,
  type NotificationRepository,
} from "@/server/notifications/service";
import { seoulCalendarDate } from "@/server/notifications/index";

const today = "2026-08-11";
const userA = "user-a";
const userB = "user-b";

const ruleInput: NotificationRuleInput = {
  today,
  pendingRecurringTransactions: [],
  plannedTransactions: [{ id: "planned-transaction-1", scheduledDate: today, baseAmount: 50_000 }],
  cardPayments: [],
  monthlyBudgets: [],
  transactions: [],
  savingsGoals: [],
};

function createFakeRepository(): NotificationRepository & { rows: NotificationRecord[] } {
  const rows: NotificationRecord[] = [];

  return {
    rows,
    async getRuleInput(_userId, requestedToday) {
      return { ...ruleInput, today: requestedToday };
    },
    async findExisting(userId, requestedCandidate) {
      return rows.some((row) =>
        row.userId === userId
        && row.type === requestedCandidate.type
        && row.title === requestedCandidate.title
        && row.message === requestedCandidate.message
        && row.relatedEntityType === requestedCandidate.relatedEntityType
        && row.relatedEntityId === requestedCandidate.relatedEntityId,
      );
    },
    async insert(userId, requestedCandidate) {
      const row: NotificationRecord = {
        id: `notification-${rows.length + 1}`,
        userId,
        type: requestedCandidate.type,
        title: requestedCandidate.title,
        message: requestedCandidate.message,
        relatedEntityType: requestedCandidate.relatedEntityType,
        relatedEntityId: requestedCandidate.relatedEntityId,
        isRead: false,
        createdAt: "2026-08-11T00:00:00.000Z",
        readAt: null,
      };
      rows.push(row);
      return row;
    },
    async list(userId) {
      return rows.filter((row) => row.userId === userId).toReversed();
    },
    async markRead(userId, id) {
      const row = rows.find((item) => item.userId === userId && item.id === id);
      if (!row) return null;
      const read: NotificationRecord = { ...row, isRead: true, readAt: "2026-08-11T00:00:00.000Z" };
      rows.splice(rows.indexOf(row), 1, read);
      return read;
    },
  };
}

describe("notification service", () => {
  it("inserts a same-day candidate only once when refreshed twice", async () => {
    const repository = createFakeRepository();
    const service = createNotificationService(repository);

    await service.refresh(userA, today);
    await service.refresh(userA, today);

    expect(repository.rows).toHaveLength(1);
    expect(repository.rows[0]).toMatchObject({ userId: userA, type: "PLANNED_DUE", relatedEntityId: "planned-transaction-1" });
  });

  it("rejects marking another user's notification as read", async () => {
    const repository = createFakeRepository();
    const service = createNotificationService(repository);
    await service.refresh(userA, today);

    await expect(service.markRead(userB, "notification-1")).rejects.toThrow("notification not found");
  });

  it("keeps refreshing when a concurrent insert loses the notification unique race", async () => {
    const repository = createFakeRepository();
    const service = createNotificationService(repository);
    repository.findExisting = async () => false;
    repository.insert = async () => {
      throw Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" });
    };

    await expect(service.refresh(userA, today)).resolves.toEqual([]);
  });

  it("uses the next Seoul calendar date exactly at midnight", () => {
    expect(seoulCalendarDate(new Date("2026-08-11T14:59:59.999Z"))).toBe("2026-08-11");
    expect(seoulCalendarDate(new Date("2026-08-11T15:00:00.000Z"))).toBe("2026-08-12");
  });
});
