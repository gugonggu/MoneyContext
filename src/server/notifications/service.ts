import "server-only";

import {
  buildNotificationCandidates,
  type NotificationCandidate,
  type NotificationRuleInput,
  type NotificationType,
} from "@/domain/notifications/rules";

export type NotificationRecord = Readonly<{
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}>;

export interface NotificationRepository {
  getRuleInput(userId: string, today: string): Promise<NotificationRuleInput>;
  findExisting(userId: string, candidate: NotificationCandidate, today: string): Promise<boolean>;
  insert(userId: string, candidate: NotificationCandidate): Promise<NotificationRecord>;
  list(userId: string): Promise<NotificationRecord[]>;
  markRead(userId: string, id: string): Promise<NotificationRecord | null>;
}

const fail = (message: string): never => { throw new Error(message); };

function assertIsoDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) fail("today must be a valid ISO date");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    fail("today must be a valid ISO date");
  }
}

export function createNotificationService(repository: NotificationRepository) {
  return {
    list: (userId: string) => repository.list(userId),
    refresh: async (userId: string, today: string) => {
      assertIsoDate(today);
      const candidates = buildNotificationCandidates(await repository.getRuleInput(userId, today));
      for (const candidate of candidates) {
        if (!await repository.findExisting(userId, candidate, today)) {
          await repository.insert(userId, candidate);
        }
      }
      return repository.list(userId);
    },
    markRead: async (userId: string, id: string) => {
      const notification = await repository.markRead(userId, id);
      if (!notification) fail("notification not found");
      return notification;
    },
  };
}
