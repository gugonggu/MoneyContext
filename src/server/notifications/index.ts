import "server-only";

import { requireCurrentProfile } from "@/server/auth/require-profile";
import { createNotificationRepository } from "@/server/notifications/repository";
import { createNotificationService } from "@/server/notifications/service";
import { createSupabaseServerClient } from "@/server/supabase/server";

function seoulCalendarDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

async function current() {
  const [profile, supabase] = await Promise.all([requireCurrentProfile(), createSupabaseServerClient()]);
  return { userId: profile.id, service: createNotificationService(createNotificationRepository(supabase)) };
}

export async function refreshNotificationsForCurrentUser() {
  const { userId, service } = await current();
  return service.refresh(userId, seoulCalendarDate());
}

export async function listNotificationsForCurrentUser() {
  const { userId, service } = await current();
  return service.list(userId);
}

export async function markNotificationReadForCurrentUser(id: string) {
  const { userId, service } = await current();
  return service.markRead(userId, id);
}
