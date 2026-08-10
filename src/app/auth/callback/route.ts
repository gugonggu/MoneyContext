import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isInviteSessionValid } from "@/server/auth/invite-session";
import { createSupabaseServerClient } from "@/server/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const inviteCookie = cookieStore.get("money_context_invite")?.value;
  if (!isInviteSessionValid(inviteCookie)) return NextResponse.redirect(new URL("/invite?error=invite", url.origin));

  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/invite?error=oauth", url.origin));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/invite?error=oauth", url.origin));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/invite?error=oauth", url.origin));
  const { data: existingProfile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!existingProfile) {
    const displayName = typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : "새 사용자";
    const { error: profileError } = await supabase.from("profiles").insert({ id: user.id, display_name: displayName, salary_cycle_day: 1 });
    if (profileError) return NextResponse.redirect(new URL("/invite?error=profile", url.origin));
  }
  cookieStore.delete("money_context_invite");
  return NextResponse.redirect(new URL("/onboarding", url.origin));
}
