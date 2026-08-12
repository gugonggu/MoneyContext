import { createSupabaseServerClient } from "@/server/supabase/server";

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production" || process.env.E2E_TEST_MODE !== "true") {
    return new Response(null, { status: 404 });
  }

  const { accessToken, refreshToken } = (await request.json()) as { accessToken?: string; refreshToken?: string };
  if (typeof accessToken !== "string" || typeof refreshToken !== "string") {
    return Response.json({ error: "accessToken and refreshToken are required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (error) return Response.json({ error: error.message }, { status: 400 });

  return new Response(null, { status: 204 });
}
