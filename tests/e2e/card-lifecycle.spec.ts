import { expect, test, type Page } from "@playwright/test";

import { createE2EUser, deleteE2EUser, signInAsE2EUser, type E2EUser } from "./support/test-user";

let user: E2EUser;
const BANK_NAME = "E2E Card Lifecycle Bank";
const CARD_NAME = "E2E Card Lifecycle Card";

// The quick-entry type radios are client-hydrated buttons; a click that lands
// before hydration finishes is a silent no-op, so retry until the click
// actually took effect rather than trusting a single click.
async function selectTransactionType(page: Page, label: string): Promise<void> {
  const radio = page.getByRole("radio", { name: label });
  await expect(async () => {
    await radio.click();
    await expect(radio).toHaveAttribute("aria-checked", "true");
  }).toPass({ timeout: 10_000 });
}

test.afterEach(async () => {
  if (user) await deleteE2EUser(user);
});

test.describe("E2E-002: credit card lifecycle", () => {
  test("a card purchase increases outstanding, and paying the card bill decreases it without double-counting expense", async ({ page }) => {
    user = await createE2EUser("card-lifecycle");
    await signInAsE2EUser(page, user);

    await page.goto("/onboarding");
    await page.getByLabel("이름", { exact: true }).fill("E2E Card Lifecycle User");
    await page.getByLabel("급여일").fill("1");
    await page.getByLabel("첫 은행 계좌").fill(BANK_NAME);
    await page.getByLabel("현재 잔액").fill("1000000");
    await page.getByLabel("신용카드 이름 (선택)").fill(CARD_NAME);
    await page.getByLabel("카드 결제일").fill("15");
    await page.getByLabel("카드 한도").fill("2000000");
    await page.getByRole("button", { name: "시작하기" }).click();
    await expect(page).toHaveURL("/home");

    // Card purchase
    await page.goto("/transactions/new");
    await selectTransactionType(page, "지출");
    await page.getByLabel("금액").fill("200000");
    await page.getByLabel("결제수단").selectOption({ label: CARD_NAME });
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByRole("status")).toHaveText("저장했습니다.");

    await page.goto("/assets");
    await expect(page.getByText("미결제액 200,000원")).toBeVisible();
    await expect(page.getByText("남은 한도 1,800,000원")).toBeVisible();

    // Pay the card bill: a transfer into the card account settles outstanding
    await page.goto("/transactions/new");
    await selectTransactionType(page, "이체");
    await page.getByLabel("출금 계좌").selectOption({ label: BANK_NAME });
    await page.getByLabel("입금 계좌").selectOption({ label: CARD_NAME });
    await page.getByLabel("금액").fill("200000");
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByRole("status")).toHaveText("저장했습니다.");

    await page.goto("/assets");
    await expect(page.getByText("미결제액 0원")).toBeVisible();
    await expect(page.getByText("남은 한도 2,000,000원")).toBeVisible();

    // The settlement transfer must not be double-counted as expense
    await page.goto("/home");
    const expenseStat = page.getByText("지출", { exact: true }).locator("..");
    await expect(expenseStat.getByText("200,000원", { exact: true })).toBeVisible();
  });
});
