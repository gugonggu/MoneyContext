import { requireAdminProfile } from "@/server/auth/require-profile";
import { rotateInviteCodeForAdmin } from "@/server/admin/invite-settings";

export async function POST(): Promise<Response> {
  await requireAdminProfile();
  return Response.json(await rotateInviteCodeForAdmin());
}
