import { requireAdminProfile } from "@/server/auth/require-profile";
import { getInviteSettingsStatus, setSignupEnabledForAdmin } from "@/server/admin/invite-settings";
import { NoInviteCodeError } from "@/server/admin/invite-settings/errors";

export async function GET(): Promise<Response> {
  await requireAdminProfile();
  return Response.json(await getInviteSettingsStatus());
}

export async function PATCH(request: Request): Promise<Response> {
  await requireAdminProfile();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const signupEnabled = (body as { signupEnabled?: unknown } | null)?.signupEnabled;
  if (typeof signupEnabled !== "boolean") {
    return Response.json({ error: "signupEnabled must be a boolean" }, { status: 400 });
  }

  try {
    await setSignupEnabledForAdmin(signupEnabled);
  } catch (error) {
    if (error instanceof NoInviteCodeError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  return new Response(null, { status: 204 });
}
