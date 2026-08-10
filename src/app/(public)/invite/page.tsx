import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createInviteSession } from "@/server/auth/invite-session";
import { isInviteCodeValid } from "@/server/auth/invite";
import { createSupabaseServerClient } from "@/server/supabase/server";

export default function InvitePage() {
  async function startOAuth(formData: FormData) {
    "use server";

    const inviteCode = formData.get("inviteCode");
    const provider = formData.get("provider");
    if (typeof inviteCode !== "string" || provider !== "google") redirect("/invite?error=invalid");
    if (!(await isInviteCodeValid(inviteCode))) redirect("/invite?error=invalid");

    const cookieStore = await cookies();
    cookieStore.set("money_context_invite", createInviteSession(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 10 * 60,
      path: "/",
    });
    const origin = process.env.NEXT_PUBLIC_APP_URL;
    if (!origin) throw new Error("Missing required environment variable: NEXT_PUBLIC_APP_URL");
    const { data, error } = await (await createSupabaseServerClient()).auth.signInWithOAuth({
      provider,
      options: { redirectTo: new URL("/auth/callback", origin).toString() },
    });
    if (error || !data.url) redirect("/invite?error=oauth");
    redirect(data.url);
  }

  return <main><h1>Money Context 시작하기</h1><form action={startOAuth}><label>초대코드<input name="inviteCode" required /></label><button name="provider" value="google">Google로 계속</button></form></main>;
}
