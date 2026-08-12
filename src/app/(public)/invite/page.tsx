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
  weak_password: "비밀번호는 6자 이상이어야 합니다.",
  email_signup: "회원가입에 실패했습니다. 이미 가입된 이메일인지 확인해주세요.",
  email_signin: "이메일 또는 비밀번호가 올바르지 않습니다.",
};

const NOTICE_MESSAGES: Record<string, string> = {
  check_email: "가입 확인 메일을 보냈어요. 메일함에서 링크를 눌러 가입을 완료해주세요.",
};

async function requireInviteCode(formData: FormData): Promise<void> {
  const inviteCode = formData.get("inviteCode");
  if (typeof inviteCode !== "string" || !(await isInviteCodeValid(inviteCode))) redirect("/invite?error=invalid");
}

async function markInviteSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set("money_context_invite", createInviteSession(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
    path: "/",
  });
}

function requireAppUrl(): string {
  const origin = process.env.NEXT_PUBLIC_APP_URL;
  if (!origin) throw new Error("Missing required environment variable: NEXT_PUBLIC_APP_URL");
  return origin;
}

export default async function InvitePage({ searchParams }: Readonly<{ searchParams: Promise<{ error?: string; notice?: string }> }>) {
  const { error, notice } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] ?? "문제가 발생했습니다. 다시 시도해주세요." : null;
  const noticeMessage = notice ? NOTICE_MESSAGES[notice] ?? null : null;

  async function startOAuth(formData: FormData) {
    "use server";

    await requireInviteCode(formData);
    await markInviteSessionCookie();

    const { data, error: oauthError } = await (await createSupabaseServerClient()).auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: new URL("/auth/callback", requireAppUrl()).toString() },
    });
    if (oauthError || !data.url) redirect("/invite?error=oauth");
    redirect(data.url);
  }

  async function signInWithEmail(formData: FormData) {
    "use server";

    await requireInviteCode(formData);
    const email = formData.get("email");
    const password = formData.get("password");
    if (typeof email !== "string" || typeof password !== "string" || !email || !password) redirect("/invite?error=email_signin");

    const { error: signInError } = await (await createSupabaseServerClient()).auth.signInWithPassword({ email, password });
    if (signInError) redirect("/invite?error=email_signin");
    redirect("/home");
  }

  async function signUpWithEmail(formData: FormData) {
    "use server";

    await requireInviteCode(formData);
    const email = formData.get("email");
    const password = formData.get("password");
    if (typeof email !== "string" || typeof password !== "string" || !email) redirect("/invite?error=email_signup");
    if (password.length < 6) redirect("/invite?error=weak_password");

    await markInviteSessionCookie();
    const { error: signUpError } = await (await createSupabaseServerClient()).auth.signUp({
      email,
      password,
      options: { emailRedirectTo: new URL("/auth/callback", requireAppUrl()).toString() },
    });
    if (signUpError) redirect("/invite?error=email_signup");
    redirect("/invite?notice=check_email");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Money Context 시작하기</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">초대코드가 있어야 가입 또는 로그인할 수 있어요.</p>

        <form className="mt-6 flex flex-col gap-4">
          <TextField label="초대코드" name="inviteCode" required autoFocus />

          {errorMessage ? (
            <Alert kind="error" role="alert">
              {errorMessage}
            </Alert>
          ) : null}
          {noticeMessage ? (
            <Alert kind="success" role="status">
              {noticeMessage}
            </Alert>
          ) : null}

          <Button type="submit" formAction={startOAuth} className="w-full">
            Google로 계속
          </Button>

          <div className="relative py-1 text-center">
            <span className="relative bg-white px-2 text-xs text-slate-400 dark:bg-slate-900 dark:text-slate-500">또는 이메일로</span>
            <div className="absolute inset-x-0 top-1/2 -z-10 border-t border-slate-200 dark:border-slate-800" />
          </div>

          <TextField label="이메일" name="email" type="email" autoComplete="email" />
          <TextField label="비밀번호" name="password" type="password" autoComplete="current-password" hint="회원가입 시 6자 이상" />

          <div className="flex gap-2">
            <Button type="submit" formAction={signInWithEmail} variant="secondary" className="flex-1">
              이메일로 로그인
            </Button>
            <Button type="submit" formAction={signUpWithEmail} variant="secondary" className="flex-1">
              이메일로 회원가입
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
