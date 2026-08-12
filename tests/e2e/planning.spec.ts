import { expect, test } from "@playwright/test";

import { createE2EUser, deleteE2EUser, signInAsE2EUser, type E2EUser } from "./support/test-user";

let user: E2EUser;

test.afterEach(async () => {
  if (user) await deleteE2EUser(user);
});

test.describe("critical path: budget and savings", () => {
  test("a monthly budget and a savings goal with a contribution reflect on the plans overview", async ({ page }) => {
    user = await createE2EUser("planning");
    await signInAsE2EUser(page, user);

    await page.goto("/onboarding");
    await page.getByLabel("이름", { exact: true }).fill("E2E Planning User");
    await page.getByLabel("급여일").fill("1");
    await page.getByLabel("첫 은행 계좌").fill("E2E Planning Bank");
    await page.getByLabel("현재 잔액").fill("1000000");
    await page.getByRole("button", { name: "시작하기" }).click();
    await expect(page).toHaveURL("/home");

    await page.goto("/plans");

    // "연도"/"월" labels also exist on the category budget form below, so
    // this form is scoped by its own heading to avoid an ambiguous match.
    const monthlyBudgetForm = page.locator("form", { hasText: "월 예산" });
    await monthlyBudgetForm.getByLabel("연도").fill("2026");
    await monthlyBudgetForm.getByLabel("월").fill("8");
    await monthlyBudgetForm.getByLabel("총 예산").fill("500000");
    await monthlyBudgetForm.getByRole("button", { name: "예산 저장" }).click();

    // The budget save is a server action that refreshes the whole /plans
    // route's server components, remounting sibling client forms below —
    // wait for that refresh to settle before typing into the goal form, or
    // keystrokes race the remount and land on a form that no longer exists.
    await page.waitForLoadState("networkidle");

    await page.getByLabel("이름").fill("E2E Goal");
    await page.getByLabel("목표 금액").fill("1000000");
    await page.getByLabel("목표일").fill("2026-12-31");
    await page.getByLabel("월 저축액").fill("100000");
    await page.getByRole("button", { name: "목표 만들기" }).click();

    await expect(page.getByRole("heading", { name: "E2E Goal" })).toBeVisible();
    await expect(page.getByText("남은 금액 1,000,000원")).toBeVisible();

    await page.getByLabel("금액", { exact: true }).fill("100000");
    await page.getByLabel("날짜").fill("2026-08-15");
    await page.getByRole("button", { name: "납입 추가" }).click();

    await expect(page.getByText("저축액 100,000원")).toBeVisible();
    await expect(page.getByText("남은 금액 900,000원")).toBeVisible();
  });
});
