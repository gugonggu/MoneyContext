import { randomBytes } from "node:crypto";

import { expect, test } from "@playwright/test";

import { createE2EUser, deleteE2EUser, type E2EUser } from "./support/test-user";

let emailUser: E2EUser;

test.beforeAll(async () => {
  emailUser = await createE2EUser("email-signin");
});

test.afterAll(async () => {
  await deleteE2EUser(emailUser);
});

test.describe("email-based authentication on /invite", () => {
  test("signs an already-registered user in directly to /home without an invite code", async ({ page }) => {
    await page.goto("/invite");
    await page.getByLabel("이메일").fill(emailUser.email);
    await page.getByLabel("비밀번호").fill(emailUser.password);
    await page.getByRole("button", { name: "이메일로 로그인" }).click();

    await expect(page).toHaveURL("/home");
  });

  test("rejects email sign-in with the wrong password", async ({ page }) => {
    await page.goto("/invite");
    await page.getByLabel("이메일").fill(emailUser.email);
    await page.getByLabel("비밀번호").fill("definitely-the-wrong-password");
    await page.getByRole("button", { name: "이메일로 로그인" }).click();

    await expect(page).toHaveURL(/\/invite\?error=email_signin/);
  });

  test("rejects signup when the invite code is wrong", async ({ page }) => {
    await page.goto("/invite");
    await page.getByLabel("초대코드").fill("not-the-real-code");
    await page.getByLabel("이메일").fill(`money-context-e2e-badcode-${randomBytes(6).toString("hex")}@example.test`);
    await page.getByLabel("비밀번호").fill("a-fine-password");
    await page.getByRole("button", { name: "이메일로 회원가입" }).click();

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
    await page.getByLabel("초대코드").fill("moneycontext909");
    await page.getByLabel("이메일").fill(`money-context-e2e-weak-${randomBytes(6).toString("hex")}@example.test`);
    await page.getByLabel("비밀번호").fill("abc");
    await page.getByRole("button", { name: "이메일로 회원가입" }).click();

    await expect(page).toHaveURL(/\/invite\?error=weak_password/);
  });
});
