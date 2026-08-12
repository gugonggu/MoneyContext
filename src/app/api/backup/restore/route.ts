import { requireCurrentProfile } from "@/server/auth/require-profile";
import { restoreBackupForCurrentUser } from "@/server/backup";

export async function POST(request: Request): Promise<Response> {
  const profile = await requireCurrentProfile();

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Invalid backup JSON" }, { status: 400 });
  }

  try {
    await restoreBackupForCurrentUser(profile.id, input);
  } catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  return new Response(null, { status: 204 });
}
