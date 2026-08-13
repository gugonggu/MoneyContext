import { expect, test } from "@playwright/test";

import { createE2EUser, deleteE2EUser, signInAsE2EUser, type E2EUser } from "./support/test-user";

let user: E2EUser;

test.afterEach(async () => {
  if (user) await deleteE2EUser(user);
});

test.describe("critical path: recurring transactions", () => {
  test("a recurring rule can be created and deactivated", async ({ page }) => {
    user = await createE2EUser("recurring");
    await signInAsE2EUser(page, user);

    await page.goto("/onboarding");
    await page.getByLabel("이름", { exact: true }).fill("E2E Recurring User");
    await page.getByLabel("급여일").fill("1");
    await page.getByLabel("첫 은행 계좌").fill("E2E Recurring Bank");
    await page.getByLabel("현재 잔액").fill("1000000");
    await page.getByRole("button", { name: "시작하기" }).click();
    await expect(page).toHaveURL("/home");

    await page.goto("/transactions/recurring");
    await page.getByLabel("금액").fill("50000");
    await page.getByLabel("반복 간격").fill("1");
    await page.getByLabel("매월 반복일 (매월 주기인 경우)").fill("1");
    await page.getByLabel("시작일").fill("2026-08-01");
    await page.getByRole("button", { name: "반복 거래 추가" }).click();

    await expect(page.getByRole("status")).toHaveText("저장했습니다.");
    await expect(page.getByText("지출 50,000원", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: "비활성화" }).click();
    await expect(page.getByText("(비활성)")).toBeVisible();
  });
});

test.describe("critical path: planned transactions", () => {
  test("a planned transaction can be created and confirmed into a real transaction", async ({ page }) => {
    user = await createE2EUser("planned");
    await signInAsE2EUser(page, user);

    await page.goto("/onboarding");
    await page.getByLabel("이름", { exact: true }).fill("E2E Planned User");
    await page.getByLabel("급여일").fill("1");
    await page.getByLabel("첫 은행 계좌").fill("E2E Planned Bank");
    await page.getByLabel("현재 잔액").fill("1000000");
    await page.getByRole("button", { name: "시작하기" }).click();
    await expect(page).toHaveURL("/home");

    await page.goto("/transactions/planned");
    await page.getByLabel("예정일").fill("2026-08-20");
    await page.getByLabel("금액").fill("30000");
    await page.getByRole("button", { name: "예정 거래 추가" }).click();

    await expect(page.getByRole("status")).toHaveText("저장했습니다.");
    await expect(page.getByRole("button", { name: "지금 확정" })).toBeVisible();

    await page.getByRole("button", { name: "지금 확정" }).click();
    await expect(page.getByText("확정됨")).toBeVisible();

    await page.goto("/home");
    const expenseStat = page.getByText("지출", { exact: true }).locator("..");
    await expect(expenseStat.getByText("30,000원", { exact: true })).toBeVisible();
  });
});
