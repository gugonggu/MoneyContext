import { requireCurrentProfile } from "@/server/auth/require-profile";
import { generateBackupForCurrentUser } from "@/server/backup";

export async function GET(): Promise<Response> {
  const profile = await requireCurrentProfile();
  const backup = await generateBackupForCurrentUser(profile.id);
  return new Response(JSON.stringify(backup), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="money-context-backup.json"',
    },
  });
}
