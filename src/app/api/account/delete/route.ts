import { requireCurrentProfile } from "@/server/auth/require-profile";
import { deleteCurrentUserAccount } from "@/server/account/delete";

export async function POST(): Promise<Response> {
  const profile = await requireCurrentProfile();

  try {
    await deleteCurrentUserAccount(profile.id);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to delete account" }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
