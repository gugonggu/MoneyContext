import { expect, test } from "@playwright/test";

import { createE2EUser, deleteE2EUser, signInAsE2EUser, type E2EUser } from "./support/test-user";

let user: E2EUser;

test.afterEach(async () => {
  if (user) await deleteE2EUser(user);
});

test.describe("E2E-001: first user onboarding", () => {
  test("invalid invite code is rejected before reaching Google sign-in", async ({ page }) => {
    await page.goto("/invite");
    await page.getByLabel("초대코드").fill("definitely-not-a-real-invite-code");
    await page.getByRole("button", { name: "Google로 계속" }).click();

    await expect(page).toHaveURL(/\/invite\?error=invalid/);
  });

  test("onboarding creates a BANK account, an EXPENSE reflects on the dashboard", async ({ page }) => {
    user = await createE2EUser("onboarding");
    await signInAsE2EUser(page, user);

    await page.goto("/onboarding");
    await page.getByLabel("이름", { exact: true }).fill("E2E Onboarding User");
    await page.getByLabel("급여일").fill("25");
    await page.getByLabel("첫 은행 계좌").fill("E2E Main Bank");
    await page.getByLabel("현재 잔액").fill("100000");
    await page.getByRole("button", { name: "시작하기" }).click();

    await expect(page).toHaveURL("/home");

    await page.goto("/transactions/new");
    await page.getByRole("radio", { name: "지출" }).click();
    await page.getByLabel("금액").fill("15000");
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByRole("status")).toHaveText("저장했습니다.");

    await page.goto("/home");
    const expenseStat = page.getByText("지출", { exact: true }).locator("..");
    await expect(expenseStat.getByText("15,000원", { exact: true })).toBeVisible();
    const liquidAssetsStat = page.getByText("유동 자산", { exact: true }).locator("..");
    await expect(liquidAssetsStat.getByText("85,000원", { exact: true })).toBeVisible();
  });
});
