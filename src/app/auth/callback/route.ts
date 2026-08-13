import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isInviteSessionValid } from "@/server/auth/invite-session";
import { createSupabaseServerClient } from "@/server/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cookieStore = await cookies();

  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/invite?error=oauth", url.origin));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/invite?error=oauth", url.origin));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/invite?error=oauth", url.origin));

  const { data: existingProfile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!existingProfile) {
    // Brand-new account: only Google sign-ups reach here without a profile,
    // and those need the invite code checked when the button was clicked.
    // Returning users (existingProfile present) skip this — login never
    // requires the invite code.
    const inviteCookie = cookieStore.get("money_context_invite")?.value;
    if (!isInviteSessionValid(inviteCookie)) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/invite?error=invalid", url.origin));
    }

    const displayName = typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : "새 사용자";
    const { error: profileError } = await supabase.from("profiles").insert({ id: user.id, display_name: displayName, salary_cycle_day: 1 });
    if (profileError) return NextResponse.redirect(new URL("/invite?error=profile", url.origin));
  }

  cookieStore.delete("money_context_invite");
  return NextResponse.redirect(new URL("/onboarding", url.origin));
}
