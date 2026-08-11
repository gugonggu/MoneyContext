import { revalidatePath } from "next/cache";

import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import {
  listNotificationsForCurrentUser,
  markNotificationReadForCurrentUser,
  refreshNotificationsForCurrentUser,
} from "@/server/notifications";

async function markRead(id: string): Promise<void> {
  "use server";

  await markNotificationReadForCurrentUser(id);
  revalidatePath("/notifications");
}

export default async function NotificationsPage() {
  await refreshNotificationsForCurrentUser();
  const notifications = await listNotificationsForCurrentUser();

  return <NotificationCenter notifications={notifications} onMarkRead={markRead} />;
}
