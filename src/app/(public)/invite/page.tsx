import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { createInviteSession } from "@/server/auth/invite-session";
import { isInviteCodeValid } from "@/server/auth/invite";
import { createSupabaseServerClient } from "@/server/supabase/server";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "초대코드가 올바르지 않습니다. 다시 확인해주세요.",
  oauth: "Google 로그인에 실패했습니다. 다시 시도해주세요.",
  profile: "프로필을 만드는 중 문제가 발생했습니다. 다시 시도해주세요.",
};

export default async function InvitePage({ searchParams }: Readonly<{ searchParams: Promise<{ error?: string }> }>) {
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] ?? "문제가 발생했습니다. 다시 시도해주세요." : null;

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
    const { data, error: oauthError } = await (await createSupabaseServerClient()).auth.signInWithOAuth({
      provider,
      options: { redirectTo: new URL("/auth/callback", origin).toString() },
    });
    if (oauthError || !data.url) redirect("/invite?error=oauth");
    redirect(data.url);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Money Context 시작하기</h1>
        <p className="mt-1 text-sm text-slate-500">초대코드가 있어야 가입 또는 로그인할 수 있어요.</p>

        <form action={startOAuth} className="mt-6 flex flex-col gap-4">
          <TextField label="초대코드" name="inviteCode" required autoFocus />

          {errorMessage ? (
            <Alert kind="error" role="alert">
              {errorMessage}
            </Alert>
          ) : null}

          <Button type="submit" name="provider" value="google" className="w-full">
            Google로 계속
          </Button>
        </form>
      </div>
    </main>
  );
}
