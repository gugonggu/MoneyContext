import { expect, test } from "@playwright/test";

import { createE2EUser, deleteE2EUser, signInAsE2EUser, type E2EUser } from "./support/test-user";

let user: E2EUser;

test.afterEach(async () => {
  if (user) await deleteE2EUser(user);
});

test.describe("E2E-003: export", () => {
  test("generates a GPT markdown export and JSON/CSV downloads reflecting the created transaction", async ({ page }) => {
    user = await createE2EUser("export");
    await signInAsE2EUser(page, user);

    await page.goto("/onboarding");
    await page.getByLabel("이름", { exact: true }).fill("E2E Export User");
    await page.getByLabel("급여일").fill("1");
    await page.getByLabel("첫 은행 계좌").fill("E2E Export Bank");
    await page.getByLabel("현재 잔액").fill("500000");
    await page.getByRole("button", { name: "시작하기" }).click();
    await expect(page).toHaveURL("/home");

    await page.goto("/transactions/new");
    await page.getByRole("radio", { name: "지출" }).click();
    await page.getByLabel("금액").fill("30000");
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByRole("status")).toHaveText("저장했습니다.");

    await page.goto("/export");
    await page.getByRole("button", { name: "미리보기 갱신" }).click();

    const markdown = page.getByLabel("Markdown 미리보기");
    await expect(markdown).toContainText("지출: 30,000 KRW");

    const downloads = page.getByRole("group", { name: "분석 데이터 다운로드" });
    const jsonHref = await downloads.getByRole("link", { name: "JSON 다운로드" }).getAttribute("href");
    const csvHref = await downloads.getByRole("link", { name: "CSV 다운로드" }).getAttribute("href");
    if (!jsonHref || !csvHref) throw new Error("Missing export download links");

    const jsonResponse = await page.request.get(jsonHref);
    expect(jsonResponse.ok()).toBe(true);
    const json = await jsonResponse.json();
    expect(json.period_summary.expense_base_amount).toBe(30000);

    const csvResponse = await page.request.get(csvHref);
    expect(csvResponse.ok()).toBe(true);
    expect(await csvResponse.text()).toContain("30000");
  });
});
