import { expect, test } from "@playwright/test";

import { createE2EUser, deleteE2EUser, signInAsE2EUser, type E2EUser } from "./support/test-user";

let user: E2EUser;

test.afterEach(async () => {
  if (user) await deleteE2EUser(user);
});

test.describe("critical path: calendar", () => {
  test("a recorded expense shows on the calendar and opens in the day sheet", async ({ page }) => {
    user = await createE2EUser("calendar");
    await signInAsE2EUser(page, user);

    await page.goto("/onboarding");
    await page.getByLabel("이름", { exact: true }).fill("E2E Calendar User");
    await page.getByLabel("급여일").fill("1");
    await page.getByLabel("첫 은행 계좌").fill("E2E Calendar Bank");
    await page.getByLabel("현재 잔액").fill("1000000");
    await page.getByRole("button", { name: "시작하기" }).click();
    await expect(page).toHaveURL("/home");

    await page.goto("/transactions/new");
    await page.getByLabel("금액").fill("47000");
    await page.getByRole("button", { name: /상세 옵션/ }).click();
    await page.getByLabel("메모").fill("E2E 점심");
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByText("저장했습니다.")).toBeVisible();

    await page.goto("/calendar");
    await expect(page.getByRole("grid", { name: "월별 기록" })).toBeVisible();

    // 오늘 칸에 지출이 반영되어야 한다.
    const expenseDay = page.getByRole("gridcell", { name: /지출 47,000원, 오늘/ });
    await expect(expenseDay).toBeVisible();

    const previousMonthUrl = await page.getByRole("link", { name: "이전 달" }).getAttribute("href");
    await page.getByRole("link", { name: "이전 달" }).click();
    await expect(page).toHaveURL(previousMonthUrl ?? /ym=/);

    await page.goBack();
    await expect(page.getByRole("grid", { name: "월별 기록" })).toBeVisible();

    await expenseDay.click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("E2E 점심")).toBeVisible();
    await expect(sheet.getByRole("link", { name: "이 날짜로 기록" })).toBeVisible();
  });
});
