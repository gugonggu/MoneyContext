import { createHash, randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { getSupabasePublicConfig } from "../../src/lib/supabase/config";
import { createE2EUser, deleteE2EUser, type E2EUser } from "./support/test-user";

type AppSettingsRow = { id: string; invite_code_hash: string; signup_enabled: boolean; created_at: string; updated_at: string };

function adminClient(): SupabaseClient {
  const { url } = getSupabasePublicConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function requirePepper(): string {
  const pepper = process.env.APP_INVITE_PEPPER;
  if (!pepper) throw new Error("Missing required environment variable: APP_INVITE_PEPPER");
  return pepper;
}

function hashInviteCode(code: string, pepper: string): string {
  return createHash("sha256").update(`${pepper}:${code}`).digest("hex");
}

const admin = adminClient();
const testInviteCode = randomBytes(9).toString("base64url");

let originalAppSettings: AppSettingsRow | null = null;
let emailUser: E2EUser;

// app_settings is a real singleton row in the shared Supabase project (the
// live invite code / signup toggle), not test fixture data - snapshot it and
// install a temporary known code for this file only, then restore exactly.
test.beforeAll(async () => {
  const { data, error } = await admin.from("app_settings").select("*").maybeSingle();
  if (error) throw new Error(error.message);
  originalAppSettings = data as AppSettingsRow | null;

  const hash = hashInviteCode(testInviteCode, requirePepper());
  if (originalAppSettings) {
    const { error: updateError } = await admin.from("app_settings").update({ invite_code_hash: hash, signup_enabled: true }).eq("id", originalAppSettings.id);
    if (updateError) throw new Error(updateError.message);
  } else {
    const { error: insertError } = await admin.from("app_settings").insert({ invite_code_hash: hash, signup_enabled: true });
    if (insertError) throw new Error(insertError.message);
  }

  emailUser = await createE2EUser("email-signin");
  const { error: profileError } = await admin.from("profiles").upsert({ id: emailUser.id, display_name: "E2E Email User", salary_cycle_day: 1, base_currency: "KRW" });
  if (profileError) throw new Error(profileError.message);
});

test.afterAll(async () => {
  await deleteE2EUser(emailUser);
  await admin.from("app_settings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (originalAppSettings) {
    const { error } = await admin.from("app_settings").insert(originalAppSettings);
    if (error) throw new Error(error.message);
  }
});

test.describe("email-based authentication on /invite", () => {
  // beforeAll/afterAll in this file mutate a shared singleton row and shared
  // fixtures once; Playwright runs beforeAll per worker, so this file must
  // stay on a single worker or the fixtures collide (duplicate inserts).
  test.describe.configure({ mode: "serial" });

  test("signs an already-registered user in directly to /home with the correct invite code and password", async ({ page }) => {
    await page.goto("/invite");
    await page.getByLabel("초대코드").fill(testInviteCode);
    await page.getByLabel("이메일").fill(emailUser.email);
    await page.getByLabel("비밀번호").fill(emailUser.password);
    await page.getByRole("button", { name: "이메일로 로그인" }).click();

    await expect(page).toHaveURL("/home");
  });

  test("rejects email sign-in with the wrong password", async ({ page }) => {
    await page.goto("/invite");
    await page.getByLabel("초대코드").fill(testInviteCode);
    await page.getByLabel("이메일").fill(emailUser.email);
    await page.getByLabel("비밀번호").fill("definitely-the-wrong-password");
    await page.getByRole("button", { name: "이메일로 로그인" }).click();

    await expect(page).toHaveURL(/\/invite\?error=email_signin/);
  });

  test("rejects any email action when the invite code is wrong", async ({ page }) => {
    await page.goto("/invite");
    await page.getByLabel("초대코드").fill("not-the-real-code");
    await page.getByLabel("이메일").fill(emailUser.email);
    await page.getByLabel("비밀번호").fill(emailUser.password);
    await page.getByRole("button", { name: "이메일로 로그인" }).click();

    await expect(page).toHaveURL(/\/invite\?error=invalid/);
  });

  // No test exercises a successful signUp() call here on purpose: Supabase
  // rejects the @example.test domain used by every other test file in this
  // suite ("email address is invalid"), and any other placeholder domain
  // still goes through Supabase's real, sharply-limited email-sending quota
  // for this project - repeatedly hitting it from E2E risks exhausting the
  // quota real users need. The weak-password case below is safe because the
  // page's own validation redirects before ever calling signUp().

  test("rejects signup with too short a password", async ({ page }) => {
    await page.goto("/invite");
    await page.getByLabel("초대코드").fill(testInviteCode);
    await page.getByLabel("이메일").fill(`money-context-e2e-weak-${randomBytes(6).toString("hex")}@example.test`);
    await page.getByLabel("비밀번호").fill("abc");
    await page.getByRole("button", { name: "이메일로 회원가입" }).click();

    await expect(page).toHaveURL(/\/invite\?error=weak_password/);
  });
});
